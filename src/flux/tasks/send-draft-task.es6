/* eslint global-require: 0 */
import Task from './task';
import Actions from '../actions';
import Message from '../models/message';
import NylasAPI from '../nylas-api';
import * as NylasAPIHelpers from '../nylas-api-helpers';
import SyncbackTaskAPIRequest from '../syncback-task-api-request';
import {APIError, RequestEnsureOnceError} from '../errors';
import SoundRegistry from '../../registries/sound-registry';
import DatabaseStore from '../stores/database-store';
import AccountStore from '../stores/account-store';
import BaseDraftTask from './base-draft-task';
import SyncbackMetadataTask from './syncback-metadata-task';
import EnsureMessageInSentFolderTask from './ensure-message-in-sent-folder-task';

const OPEN_TRACKING_ID = NylasEnv.packages.pluginIdFor('open-tracking')
const LINK_TRACKING_ID = NylasEnv.packages.pluginIdFor('link-tracking')

/**
 * TOOD: NOTE: The SendDraft process is extremely sensitive to the worker
 * window crashing part-way through sending. This will be true until we
 * unifiy N1 and K2's sync worker systems.
 *
 * Unfortunately the sendMessage "API" request is wrapped in
 * SyncbackTaskAPIRequest. The API task doesn't resolve until the
 * corresponding SyncbackTask has been processed in K2 and either
 * succeeded or failed. We only know if this happens based on listening to
 * the DeltaStream for a SyncbackTask delta.
 *
 * If the worker window (where the TaskQueue and K2 live) reboots before
 * K2 gets around to actually running the task, then our `SendDraftTask`
 * will be half-way through performRemote when it reboots. The TaskQueue
 * will attempt to restore from disk, but the fact we were half-way
 * through the performRemote, and the syncbackRequest handler we were
 * listening to is currently not saved to disk. This means that
 * SendDraftTask will never know when or if the corresponding K2
 * SyncbackTask ever finished.
 *
 * Not knowing this it will try and send the task again, but fail due to
 * the ensureOnce protection we have preventing API requests from running
 * twice.
 */
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
    .then(this.ensureInSentFolder)
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

  hasCustomBodyPerRecipient = () => {
    if (!this.allowMultiSend) {
      return false;
    }

    // Sending individual bodies for too many participants can cause us
    // to hit the smtp rate limit.
    if (this.draft.participants({includeFrom: false, includeBcc: true}).length > 10) {
      return false;
    }

    const pluginsAvailable = (OPEN_TRACKING_ID && LINK_TRACKING_ID);
    if (!pluginsAvailable) {
      return false;
    }
    const pluginsInUse = (this.draft.metadataForPluginId(OPEN_TRACKING_ID) || this.draft.metadataForPluginId(LINK_TRACKING_ID)) || false;
    const providerCompatible = (AccountStore.accountForId(this.draft.accountId).provider !== "eas");
    return pluginsInUse && providerCompatible;
  }

  sendMessage = async () => {
    if (this.hasCustomBodyPerRecipient()) {
      await this._sendPerRecipient();
    } else {
      await this._sendWithSingleBody()
    }
  }

  ensureInSentFolder = () => {
    const t = new EnsureMessageInSentFolderTask({
      message: this.message,
      sentPerRecipient: this.hasCustomBodyPerRecipient(),
    })
    Actions.queueTask(t)
  }

  _sendWithSingleBody = async () => {
    const task = new SyncbackTaskAPIRequest({
      api: NylasAPI,
      options: {
        path: "/send",
        accountId: this.draft.accountId,
        method: 'POST',
        body: this.draft.toJSON(),
        timeout: 1000 * 60 * 5, // We cannot hang up a send - won't know if it sent
        ensureOnce: true,
        requestId: this.draft.clientId,
      },
    })
    const responseJSON = await task.run();
    await this._createMessageFromResponse(responseJSON)
  }

  _sendPerRecipient = async () => {
    const task = new SyncbackTaskAPIRequest({
      api: NylasAPI,
      options: {
        path: "/send-per-recipient",
        accountId: this.draft.accountId,
        method: 'POST',
        body: {
          message: this.draft.toJSON(),
          uses_open_tracking: this.draft.metadataForPluginId(OPEN_TRACKING_ID) != null,
          uses_link_tracking: this.draft.metadataForPluginId(LINK_TRACKING_ID) != null,
        },
        timeout: 1000 * 60 * 5, // We cannot hang up a send - won't know if it sent
      },
    })
    const responseJSON = await task.run();
    await this._createMessageFromResponse(responseJSON);
  }

  updatePluginMetadata = () => {
    this.message.pluginMetadata.forEach((m) => {
      const t1 = new SyncbackMetadataTask(this.message.clientId,
          this.message.constructor.name, m.pluginId);
      Actions.queueTask(t1);
    });

    return Promise.resolve();
  }

  _createMessageFromResponse = (responseJSON) => {
    const {failedRecipients, message} = responseJSON
    if (failedRecipients && failedRecipients.length > 0) {
      const errorMessage = `We had trouble sending this message to all recipients. ${failedRecipients} may not have received this email.`;
      NylasEnv.showErrorDialog(errorMessage, {showInMainWindow: true});
    }

    this.message = new Message().fromJSON(message);
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

  onSuccess = () => {
    Actions.recordUserEvent("Draft Sent")
    Actions.draftDeliverySucceeded({message: this.message, messageClientId: this.message.clientId, draftClientId: this.draft.clientId});
    // TODO we shouldn't need to do this anymore
    NylasAPIHelpers.makeDraftDeletionRequest(this.draft);

    // Play the sending sound
    if (this.playSound && NylasEnv.config.get("core.sending.sounds")) {
      SoundRegistry.playSound('send');
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
        if (err.body.message.includes('at least one recipient')) {
          message = `This message could not be delivered to at least one recipient. (Note: other recipients may have received this message - you should check Sent Mail before re-sending this message.)`;
        } else {
          message = `Sorry, this message could not be sent because it was rejected by your mail provider. (${err.body.message})`;
          if (err.body.server_error) {
            message += `\n\n${err.body.server_error}`;
          }
        }
      }
    }

    if (this.emitError) {
      if (err instanceof RequestEnsureOnceError) {
        Actions.draftDeliveryFailed({
          threadId: this.draft.threadId,
          draftClientId: this.draft.clientId,
          errorMessage: `WARNING: Your message MIGHT have sent. We encountered a network problem while the send was in progress. Please wait a few minutes then check your sent folder and try again if necessary.`,
          errorDetail: `Please email support@nylas.com if you see this error message.`,
        });
      } else {
        Actions.draftDeliveryFailed({
          threadId: this.draft.threadId,
          draftClientId: this.draft.clientId,
          errorMessage: message,
          errorDetail: err.message + (err.error ? err.error.stack : '') + err.stack,
        });
      }
    }
    NylasEnv.reportError(err);

    return Promise.resolve([Task.Status.Failed, err]);
  }
}
