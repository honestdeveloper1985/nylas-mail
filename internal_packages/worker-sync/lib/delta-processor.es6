import _ from 'underscore';
import {
  Actions,
  Thread,
  Message,
  NylasAPIHelpers,
  DatabaseStore,
  MailRulesProcessor,
} from 'nylas-exports';

/**
 * This injests deltas from multiple sources. One is from local-sync, the
 * other is from n1-cloud. Both sources use
 * isomorphic-core/src/delta-stream-builder to generate the delta stream.
 *
 * In both cases we are given the JSON serialized form of a `Transaction`
 * model. An example Thread delta would look like:
 *
 *   modelDelta = {
 *     id: 518,
 *     event: "modify",
 *     object: "thread",
 *     objectId: 2887,
 *     changedFields: ["subject", "unread"],
 *     attributes: {
 *       id: 2887,
 *       object: 'thread',
 *       account_id: 2,
 *       subject: "Hello World",
 *       unread: true,
 *       ...
 *     }
 *   }
 *
 * An example Metadata delta would look like:
 *
 *   metadataDelta = {
 *     id: 519,
 *     event: "create",
 *     object: "metadata",
 *     objectId: 8876,
 *     changedFields: ["version", "object"],
 *     attributes: {
 *       id: 8876,
 *       value: {link_clicks: 1},
 *       object: "metadata",
 *       version: 2,
 *       plugin_id: "link-tracking",
 *       object_id: 2887,
 *       object_type: "thread"
 *       account_id: 2,
 *     }
 *   }
 *
 * The `object` may be "thread", "message", "metadata", or any other model
 * type we support
 */
class DeltaProcessor {
  constructor() {
    this.activationTime = Date.now()
  }

  async process(rawDeltas = []) {
    try {
      const deltas = await this._decorateDeltas(rawDeltas);
      Actions.longPollReceivedRawDeltas(deltas);

      const {
        modelDeltas,
        accountDeltas,
        metadataDeltas,
      } = this._extractDeltaTypes(deltas);
      this._handleAccountDeltas(accountDeltas);

      const models = await this._saveModels(modelDeltas);
      await this._saveMetadata(metadataDeltas);
      await this._notifyOfNewMessages(models.created);
      this._notifyOfSyncbackRequestDeltas(models)
    } catch (err) {
      console.error(rawDeltas)
      console.error("DeltaProcessor: Process failed.", err)
      NylasEnv.reportError(err);
    } finally {
      Actions.longPollProcessedDeltas()
    }
  }

  /**
   * Create a (non-enumerable) reference from the attributes which we
   * carry forward back to their original deltas. This allows us to
   * mark the deltas that the app ignores later in the process.
   */
  _decorateDeltas(rawDeltas) {
    rawDeltas.forEach((delta) => {
      if (!delta.attributes) return;
      Object.defineProperty(delta.attributes, '_delta', {
        configurable: true,
        get() { return delta; },
      });
    })
    return rawDeltas
  }

  _extractDeltaTypes(rawDeltas) {
    const modelDeltas = []
    const accountDeltas = []
    const metadataDeltas = []
    rawDeltas.forEach((delta) => {
      if (delta.object === "metadata") {
        metadataDeltas.push(delta)
      } else if (delta.object === "account") {
        accountDeltas.push(delta)
      } else {
        modelDeltas.push(delta)
      }
    })
    return {modelDeltas, metadataDeltas, accountDeltas}
  }

  _handleAccountDeltas = (accountDeltas) => {
    const {modify} = this._clusterDeltas(accountDeltas);
    if (!modify.account) return;
    for (const accountJSON of _.values(modify.account)) {
      Actions.updateAccount(accountJSON.account_id, {syncState: accountJSON.sync_state});
      if (accountJSON.sync_state !== "running") {
        Actions.recordUserEvent('Account Sync Errored', {
          accountId: accountJSON.account_id,
          syncState: accountJSON.sync_state,
        });
      }
    }
  }

  _notifyOfSyncbackRequestDeltas({created, updated} = {}) {
    const createdRequests = created.syncbackRequest || []
    const updatedRequests = updated.syncbackRequest || []
    const syncbackRequests = createdRequests.concat(updatedRequests)
    if (syncbackRequests.length === 0) { return }

    Actions.didReceiveSyncbackRequestDeltas(syncbackRequests)
  }

  async _saveModels(modelDeltas) {
    const {create, modify, destroy} = this._clusterDeltas(modelDeltas);

    const created = await Promise.props(_.mapObject(create, (val) =>
      NylasAPIHelpers.handleModelResponse(_.values(val))
    ))

    const updated = await Promise.props(_.mapObject(modify, (val) =>
      NylasAPIHelpers.handleModelResponse(_.values(val))
    ));

    await Promise.map(destroy, this._handleDestroyDelta);

    return {created, updated};
  }

  async _saveMetadata(deltas) {
    const all = {};

    for (const delta of deltas.filter(d => d.event === 'create')) {
      all[delta.attributes.object_id] = delta.attributes;
    }
    for (const delta of deltas.filter(d => d.event === 'modify')) {
      all[delta.attributes.object_id] = delta.attributes;
    }
    const allByObjectType = _.groupBy(_.values(all), "object_type")

    return Promise.map(Object.keys(allByObjectType), (objType) => {
      const jsons = allByObjectType[objType]
      const klass = NylasAPIHelpers.apiObjectToClassMap[objType];
      const objectIds = jsons.map(j => j.object_id)

      return DatabaseStore.inTransaction((t) => {
        return this._findModelsForMetadata(t, klass, objectIds).then((modelsByObjectId) => {
          const models = [];
          Object.keys(modelsByObjectId).forEach((objectId) => {
            const model = modelsByObjectId[objectId];
            const metadataJSON = all[objectId];
            const modelWithMetadata = model.applyPluginMetadata(metadataJSON.plugin_id, metadataJSON.value);
            const localMetadatum = modelWithMetadata.metadataObjectForPluginId(metadataJSON.plugin_id);
            localMetadatum.version = metadataJSON.version;
            models.push(model);
          })
          return t.persistModels(models)
        });
      });
    })
  }

  /**
  @param ids An array of metadata object_ids
  @returns A map of the object_ids to models in the database, resolving the
  IDs as necessary. Must be a hashmap because the metadata object_ids may not
  actually be present in the resulting models.
  */
  _findModelsForMetadata(t, klass, ids) {
    if (klass === Thread) {
      // go through the Message table first, since local Thread IDs may be
      // the (static) ID of any Message in the thread
      // We prepend 't:' to thread IDs to avoid global object ID conflicts
      const messageIds = ids.map(i => i.slice(2))
      return t.findAll(Message, {id: messageIds}).then((messages) => {
        if (messages.length !== messageIds.length) {
          throw new Error(`Didn't find message for each thread. Thread IDs from remote: ${ids}`);
        }
        const threadIds = messages.map(m => m.threadId);
        return t.findAll(Thread, {id: threadIds}).then((threads) => {
          const map = {};
          for (const thread of threads) {
            const pluginObjectId = ids[threadIds.indexOf(thread.id)];
            map[pluginObjectId] = thread;
          }
          return map;
        });
      });
    }
    return t.findAll(klass, {id: ids}).then((models) => {
      const map = {};
      for (const model of models) {
        const pluginObjectId = model.id;
        map[pluginObjectId] = model;
      }
      return map;
    });
  }

  /**
   * Group deltas by object type so we can mutate the cache efficiently.
   * NOTE: This code must not just accumulate creates, modifies and
   * destroys but also de-dupe them. We cannot call
   * "persistModels(itemA, itemA, itemB)" or it will throw an exception
   */
  _clusterDeltas(deltas) {
    const create = {};
    const modify = {};
    const destroy = [];
    for (const delta of deltas) {
      if (delta.event === 'create') {
        if (!create[delta.object]) { create[delta.object] = {}; }
        create[delta.object][delta.attributes.id] = delta.attributes;
      } else if (delta.event === 'modify') {
        if (!modify[delta.object]) { modify[delta.object] = {}; }
        modify[delta.object][delta.attributes.id] = delta.attributes;
      } else if (delta.event === 'delete') {
        destroy.push(delta);
      }
    }

    return {create, modify, destroy};
  }

  async _notifyOfNewMessages(created) {
    const incomingMessages = created.message || [];

    // Filter for new messages that are not sent by the current user
    const newUnread = incomingMessages.filter((msg) => {
      const isUnread = msg.unread === true;
      const isNew = msg.date && msg.date.valueOf() >= this.activationTime;
      const isFromMe = msg.isFromMe();
      return isUnread && isNew && !isFromMe;
    });

    if (newUnread.length === 0) {
      return;
    }

    try {
      await MailRulesProcessor.processMessages(created.message || [])
    } catch (err) {
      console.error("DeltaProcessor: Running mail rules on incoming mail failed.")
    }
    Actions.onNewMailDeltas(created)
  }

  _handleDestroyDelta(delta) {
    const klass = NylasAPIHelpers.apiObjectToClassMap[delta.object];
    if (!klass) { return Promise.resolve(); }

    return DatabaseStore.inTransaction(t => {
      return t.find(klass, delta.objectId).then((model) => {
        if (!model) { return Promise.resolve(); }
        return t.unpersistModel(model);
      });
    });
  }
}

export default new DeltaProcessor()
