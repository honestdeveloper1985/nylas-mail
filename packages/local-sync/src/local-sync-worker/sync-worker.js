const {
  IMAPConnection,
  IMAPErrors,
  PromiseUtils,
} = require('isomorphic-core');
const LocalDatabaseConnector = require('../shared/local-database-connector')
const LocalPubsubConnector = require('../shared/local-pubsub-connector')
const MessageTypes = require('../shared/message-types')
const {
  jsonError,
} = require('./sync-utils')

const FetchFolderList = require('./imap/fetch-folder-list')
const FetchMessagesInFolder = require('./imap/fetch-messages-in-folder')
const SyncbackTaskFactory = require('./syncback-task-factory')


class SyncWorker {
  constructor(account, db, onExpired) {
    this._db = db;
    this._conn = null;
    this._account = account;
    this._startTime = Date.now();
    this._lastSyncTime = null;
    this._onExpired = onExpired;
    this._logger = global.Logger.forAccount(account)

    this._syncTimer = null;
    this._destroyed = false;

    this.syncNow({reason: 'Initial'});

    this._onMessage = this._onMessage.bind(this);
    this._listener = LocalPubsubConnector.observeAccount(account.id).subscribe(this._onMessage)
  }

  cleanup() {
    clearTimeout(this._syncTimer);
    this._syncTimer = null;
    this._destroyed = true;
    this._listener.dispose();
    this.closeConnection()
  }

  closeConnection() {
    if (this._conn) {
      this._conn.end();
    }
  }

  _onMessage(msg) {
    const {type} = JSON.parse(msg);
    switch (type) {
      case MessageTypes.ACCOUNT_CREATED:
        // No other processing currently required for account creation
        break;
      case MessageTypes.ACCOUNT_UPDATED:
        this._onAccountUpdated();
        break;
      case MessageTypes.ACCOUNT_DELETED:
        this.cleanup();
        this._onExpired();
        break;
      case MessageTypes.SYNCBACK_REQUESTED:
        this.syncNow({reason: 'Syncback Action Queued'});
        break;
      default:
        this._logger.error({message: msg}, 'SyncWorker: Invalid message')
    }
  }

  _onAccountUpdated() {
    const syncingNow = !this.isWaitingForNextSync()
    const syncingJustFinished = (Date.now() - this._lastSyncTime < 5000);

    if (syncingNow || syncingJustFinished) {
      return;
    }

    this._getAccount().then((account) => {
      this._account = account;
      this.syncNow({reason: 'Account Modification'});
    })
    .catch((err) => {
      this._logger.error(err, 'SyncWorker: Error getting account for update')
    })
  }

  _onConnectionIdleUpdate() {
    if (!this.isWaitingForNextSync()) {
      return;
    }
    this.syncNow({reason: 'IMAP IDLE Fired'});
  }

  _getAccount() {
    return LocalDatabaseConnector.forShared().then(({Account}) =>
      Account.find({where: {id: this._account.id}})
    );
  }

  _getIdleFolder() {
    return this._db.Folder.find({where: {role: ['all', 'inbox']}})
  }

  ensureConnection() {
    if (this._conn) {
      return this._conn.connect();
    }
    const settings = this._account.connectionSettings;
    const credentials = this._account.decryptedCredentials();

    if (!settings || !settings.imap_host) {
      return Promise.reject(new Error("ensureConnection: There are no IMAP connection settings for this account."))
    }
    if (!credentials) {
      return Promise.reject(new Error("ensureConnection: There are no IMAP connection credentials for this account."))
    }

    const conn = new IMAPConnection({
      db: this._db,
      settings: Object.assign({}, settings, credentials),
      logger: this._logger,
    });

    conn.on('mail', () => {
      this._onConnectionIdleUpdate();
    })
    conn.on('update', () => {
      this._onConnectionIdleUpdate();
    })
    conn.on('queue-empty', () => {
    });

    this._conn = conn;
    return this._conn.connect();
  }

  syncbackMessageActions() {
    const where = {where: {status: "NEW"}, limit: 100};
    return PromiseUtils.each((this._db.SyncbackRequest.findAll(where)
          .map((req) => SyncbackTaskFactory.create(this._account, req))),
          this.runSyncbackTask.bind(this))
  }

  runSyncbackTask(task) {
    const syncbackRequest = task.syncbackRequestObject()
    return this._conn.runOperation(task)
    .then(() => {
      syncbackRequest.status = "SUCCEEDED"
    })
    .catch((error) => {
      syncbackRequest.error = error
      syncbackRequest.status = "FAILED"
    })
    .finally(() => syncbackRequest.save())
  }

  syncAllCategories() {
    const {Folder} = this._db;
    const {folderSyncOptions} = this._account.syncPolicy;

    return Folder.findAll().then((categories) => {
      const priority = ['inbox', 'all', 'drafts', 'sent', 'spam', 'trash'].reverse();
      const categoriesToSync = categories.sort((a, b) =>
        (priority.indexOf(a.role) - priority.indexOf(b.role)) * -1
      )

      return Promise.all(categoriesToSync.map((cat) =>
        this._conn.runOperation(new FetchMessagesInFolder(cat, folderSyncOptions, this._logger))
      ))
    });
  }

  syncNow({reason} = {}) {
    clearTimeout(this._syncTimer);
    this._syncTimer = null;

    this._account.reload().then(() => {
      if (!process.env.SYNC_AFTER_ERRORS && this._account.errored()) {
        this._logger.info(`SyncWorker: Account is in error state - Skipping sync`)
        return Promise.resolve();
      }
      this._logger.info({reason}, `SyncWorker: Account sync started`)

      return this._account.update({syncError: null})
      .then(() => this.ensureConnection())
      .then(() => this.syncbackMessageActions())
      .then(() => this._conn.runOperation(new FetchFolderList(this._account.provider, this._logger)))
      .then(() => this.syncAllCategories())
      .then(() => this.onSyncDidComplete())
      .catch((error) => this.onSyncError(error))
    })
    .finally(() => {
      this._lastSyncTime = Date.now()
      this.scheduleNextSync()
    })
  }

  onSyncError(error) {
    this.closeConnection()

    this._logger.error(error, `SyncWorker: Error while syncing account`)

    // Continue to retry if it was a network error
    if (error instanceof IMAPErrors.RetryableError) {
      return Promise.resolve()
    }

    this._account.syncError = jsonError(error)
    return this._account.save()
  }

  onSyncDidComplete() {
    const {afterSync} = this._account.syncPolicy;
    const now = Date.now();

    if (!this._account.firstSyncCompletion) {
      this._account.firstSyncCompletion = now;
    }

    const syncGraphTimeLength = 60 * 30; // 30 minutes, should be the same as SyncGraph.config.timeLength
    let lastSyncCompletions = [].concat(this._account.lastSyncCompletions)
    lastSyncCompletions = [now, ...lastSyncCompletions]
    while (now - lastSyncCompletions[lastSyncCompletions.length - 1] > 1000 * syncGraphTimeLength) {
      lastSyncCompletions.pop();
    }

    this._account.lastSyncCompletions = lastSyncCompletions
    this._account.save()

    this._logger.info('Syncworker: Completed sync cycle')

    if (afterSync === 'idle') {
      return this._getIdleFolder()
      .then((idleFolder) => this._conn.openBox(idleFolder.name))
      .then(() => this._logger.info('SyncWorker: Idling on inbox category'))
    }

    if (afterSync === 'close') {
      this._logger.info('SyncWorker: Closing connection');
      this.closeConnection()
      return Promise.resolve()
    }

    this._logger.error({after_sync: afterSync}, `SyncWorker.onSyncDidComplete: Unknown afterSync behavior`)
    throw new Error('SyncWorker.onSyncDidComplete: Unknown afterSync behavior')
  }

  isWaitingForNextSync() {
    return this._syncTimer != null;
  }

  scheduleNextSync() {
    const {intervals} = this._account.syncPolicy;
    const target = this._lastSyncTime + intervals.active;

    this._syncTimer = setTimeout(() => {
      this.syncNow({reason: 'Scheduled'});
    }, target - Date.now());
  }
}

module.exports = SyncWorker;
