/* eslint global-require: 0 */
import {RegExpUtils} from 'nylas-exports';
import Task from './task';
import Actions from '../actions';
import Message from '../models/message';
import NylasAPI from '../nylas-api';
import * as NylasAPIHelpers from '../nylas-api-helpers';
import NylasAPIRequest from '../nylas-api-request';
import SyncbackTaskAPIRequest from '../syncback-task-api-request';
import {APIError, RequestEnsureOnceError} from '../errors';
import SoundRegistry from '../../registries/sound-registry';
import DatabaseStore from '../stores/database-store';
import AccountStore from '../stores/account-store';
import BaseDraftTask from './base-draft-task';
import MultiSendToIndividualTask from './multi-send-to-individual-task';
import MultiSendSessionCloseTask from './multi-send-session-close-task';
import SyncbackMetadataTask from './syncback-metadata-task';


// TODO
// Refactor this to consolidate error handling across all Sending tasks
export default class SendDraftTask extends BaseDraftTask {

  constructor(draftClientId, {playSound = true, emitError = true, allowMultiSend = true} = {}) {
    super(draftClientId);
    this.draft = null;
    this.message = null;
    this.emitError = emitError
    this.playSound = playSound
    this.allowMultiSend = allowMultiSend
  }

  label() {
    return "Sending message...";
  }

  performRemote() {
    return this.refreshDraftReference()
    .then(this.assertDraftValidity)
    .then(this.sendMessage)
    .then(this.updatePluginMetadata)
    .then(this.onSuccess)
    .catch(this.onError);
  }

  assertDraftValidity = () => {
    if (!this.draft.from[0]) {
      return Promise.reject(new Error("SendDraftTask - you must populate `from` before sending."));
    }

    const account = AccountStore.accountForEmail(this.draft.from[0].email);
    if (!account) {
      return Promise.reject(new Error("SendDraftTask - you can only send drafts from a configured account."));
    }
    if (this.draft.accountId !== account.id) {
      return Promise.reject(new Error("The from address has changed since you started sending this draft. Double-check the draft and click 'Send' again."));
    }
    return Promise.resolve();
  }

  usingMultiSend = () => {
    if (!this.allowMultiSend) {
      return false;
    }

    // Sending individual bodies for too many participants can cause us
    // to hit the smtp rate limit.
    if (this.draft.participants({includeFrom: false, includeBcc: true}).length > 10) {
      return false;
    }

    const openTrackingId = NylasEnv.packages.pluginIdFor('open-tracking')
    const linkTrackingId = NylasEnv.packages.pluginIdFor('link-tracking')

    const pluginsAvailable = (openTrackingId && linkTrackingId);
    if (!pluginsAvailable) {
      return false;
    }
    const pluginsInUse = (this.draft.metadataForPluginId(openTrackingId) || this.draft.metadataForPluginId(linkTrackingId));
    const providerCompatible = (AccountStore.accountForId(this.draft.accountId).provider !== "eas");
    return pluginsInUse && providerCompatible;
  }

  sendMessage = () => {
    return this.usingMultiSend() ? this.sendWithMultipleBodies() : this.sendWithSingleBody();
  }

  sendWithMultipleBodies = () => {
    const draft = this.draft.clone();
    // We strip the tracking links because this is the message that will be
    // saved to the user's sent folder, and we don't want it to contain the
    // tracking links
    draft.body = this.stripTrackingFromBody(draft.body);

    return new NylasAPIRequest({
      api: NylasAPI,
      options: {
        path: "/send-multiple",
        accountId: this.draft.accountId,
        method: 'POST',
        body: draft.toJSON(),
        timeout: 1000 * 60 * 5, // We cannot hang up a send - won't know if it sent
        returnsModel: false,
      },
    })
    .run()
    .then((responseJSON) => {
      return this.createMessageFromResponse(responseJSON);
    })
    .then(() => {
      const recipients = this.message.participants({includeFrom: false, includeBcc: true})
      recipients.forEach((recipient) => {
        const t1 = new MultiSendToIndividualTask({
          message: this.message,
          recipient: recipient,
        });
        Actions.queueTask(t1);
      });
      const t2 = new MultiSendSessionCloseTask({
        message: this.message,
        draft: draft,
      });
      Actions.queueTask(t2);
    })
  }

  // This function returns a promise that resolves to the draft when the draft has
  // been sent successfully.
  sendWithSingleBody = () => {
    return new SyncbackTaskAPIRequest({
      api: NylasAPI,
      options: {
        path: "/send",
        accountId: this.draft.accountId,
        method: 'POST',
        body: this.draft.toJSON(),
        timeout: 1000 * 60 * 5, // We cannot hang up a send - won't know if it sent
        returnsModel: false,
        ensureOnce: true,
        requestId: this.draft.clientId,
      },
    })
    .run()
    .then((responseJSON) => {
      return this.createMessageFromResponse(responseJSON)
    })
  }

  updatePluginMetadata = () => {
    this.message.pluginMetadata.forEach((m) => {
      const t1 = new SyncbackMetadataTask(this.message.clientId,
          this.message.constructor.name, m.pluginId);
      Actions.queueTask(t1);
    });

    return Promise.resolve();
  }

  createMessageFromResponse = (responseJSON) => {
    this.message = new Message().fromJSON(responseJSON);
    this.message.clientId = this.draft.clientId;
    this.message.body = this.draft.body;
    this.message.draft = false;
    this.message.clonePluginMetadataFrom(this.draft);

    return DatabaseStore.inTransaction((t) =>
      this.refreshDraftReference().then(() => {
        return t.persistModel(this.message);
      })
    );
  }

  stripTrackingFromBody(text) {
    let body = text.replace(/<img class="n1-open"[^<]+src="([a-zA-Z0-9-_:/.]*)">/g, () => {
      return "";
    });
    body = body.replace(RegExpUtils.urlLinkTagRegex(), (match, prefix, url, suffix, content, closingTag) => {
      const param = url.split("?")[1];
      if (param) {
        const link = decodeURIComponent(param.split("=")[1]);
        return `${prefix}${link}${suffix}${content}${closingTag}`;
      }
      return match;
    });
    return body;
  }

  onSuccess = () => {
    // TODO: This code is duplicated into the MultiSendSessionCloseTask!
    // We should create a Task that always runs when send is complete.
    if (!this.usingMultiSend()) {
      Actions.recordUserEvent("Draft Sent")
      Actions.sendDraftSuccess({message: this.message, messageClientId: this.message.clientId, draftClientId: this.draft.clientId});
      NylasAPIHelpers.makeDraftDeletionRequest(this.draft);

      // Play the sending sound
      if (this.playSound && NylasEnv.config.get("core.sending.sounds")) {
        SoundRegistry.playSound('send');
      }
    }
    return Promise.resolve(Task.Status.Success);
  }

  onError = (err) => {
    if (err instanceof BaseDraftTask.DraftNotFoundError) {
      return Promise.resolve(Task.Status.Continue);
    }

    let message = err.message;

    if (err instanceof APIError) {
      message = `Sorry, this message could not be sent. Please try again, and make sure your message is addressed correctly and is not too large.`;
      if (err.statusCode === 402 && err.body.message) {
        if (err.body.message.indexOf('at least one recipient') !== -1) {
          message = `This message could not be delivered to at least one recipient. (Note: other recipients may have received this message - you should check Sent Mail before re-sending this message.)`;
        } else {
          message = `Sorry, this message could not be sent because it was rejected by your mail provider. (${err.body.message})`;
          if (err.body.server_error) {
            message += `\n\n${err.body.server_error}`;
          }
        }
      }
    }

    if (err instanceof RequestEnsureOnceError) {
      // TODO delete draft
    }

    if (this.emitError && !(err instanceof RequestEnsureOnceError)) {
      Actions.sendDraftFailed({
        threadId: this.draft.threadId,
        draftClientId: this.draft.clientId,
        errorMessage: message,
        errorDetail: err.message + (err.error ? err.error.stack : '') + err.stack,
      });
    }
    NylasEnv.reportError(err);

    return Promise.resolve([Task.Status.Failed, err]);
  }
}
