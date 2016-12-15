import _ from 'underscore';
import {
  Actions,
  NylasAPI,
  N1CloudAPI,
  DatabaseStore,
  NylasLongConnection,
} from 'nylas-exports';
import DeltaStreamingConnection from './delta-streaming-connection';
import DeltaProcessor from './delta-processor'
import ContactRankingsCache from './contact-rankings-cache';

/**
 * This manages the syncing of N1 assets. We create one worker per email
 * account. We save the state of the worker in the database.
 *
 * The `state` takes the following schema:
 * this._state = {
 *   "deltaCursors": {
 *     n1Cloud: 523,
 *     localSync: 1108,
 *   }
 *   "deltaStatus": {
 *     n1Cloud: "closed",
 *     localSync: "connecting",
 *   }
 * }
 *
 * It can be null to indicate
 */
export default class NylasSyncWorker {

  constructor(account) {
    this._state = { deltaCursors: {}, deltaStatus: {} }
    this._writeStateDebounced = _.debounce(this._writeState, 100)
    this._account = account;
    this._unlisten = Actions.retrySync.listen(this.refresh.bind(this), this);
    this._deltaStreams = this._setupDeltaStreams(account);
    this._refreshingCaches = [new ContactRankingsCache(account.id)];
    NylasEnv.onBeforeUnload = (readyToUnload) => {
      this._writeState().finally(readyToUnload)
    }
  }

  loadStateFromDatabase() {
    return DatabaseStore.findJSONBlob(`NylasSyncWorker:${this._account.id}`).then(json => {
      if (!json) return;
      this._state = json;
      if (!this._state.deltaCursors) this._state.deltaCursors = {}
      if (!this._state.deltaStatus) this._state.deltaStatus = {}
    });
  }

  account() {
    return this._account;
  }

  refresh() {
    this.cleanup();
    // Cleanup defaults to an "ENDED" socket. We need to indicate it's
    // merely closed and can be re-opened again immediately.
    _.map(this._deltaStreams, s => s.setStatus(NylasLongConnection.Status.Closed))
    return this.start();
  }

  start = () => {
    this._refreshingCaches.map(c => c.start());
    _.map(this._deltaStreams, s => s.start())
  }

  cleanup() {
    this._unlisten();
    _.map(this._deltaStreams, s => s.end())
    this._refreshingCaches.map(c => c.end());
  }

  _setupDeltaStreams = (account) => {
    const localSync = new DeltaStreamingConnection(NylasAPI,
        account.id, this._deltaStreamOpts("localSync"));

    const n1Cloud = new DeltaStreamingConnection(N1CloudAPI,
        account.id, this._deltaStreamOpts("n1Cloud"));

    return {localSync, n1Cloud};
  }

  _deltaStreamOpts = (streamName) => {
    return {
      getCursor: () => this._state.deltaCursors[streamName],
      setCursor: (val) => {
        this._state.deltaCursors[streamName] = val;
        this._writeStateDebounced();
      },
      onDeltas: DeltaProcessor.process.bind(DeltaProcessor),
      onStatusChanged: (status) => {
        this._state.deltaStatus[streamName] = status;
        this._writeStateDebounced();
      },
    }
  }

  _writeState() {
    return DatabaseStore.inTransaction(t => {
      return t.persistJSONBlob(`NylasSyncWorker:${this._account.id}`, this._state);
    });
  }
}
