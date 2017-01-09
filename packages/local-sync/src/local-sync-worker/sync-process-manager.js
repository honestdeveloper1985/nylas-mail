const _ = require('underscore')
const {Actions} = require('nylas-exports')
const SyncWorker = require('./sync-worker');
const LocalDatabaseConnector = require('../shared/local-database-connector')

/*
Accounts ALWAYS exist in either `accounts:unclaimed` or an `accounts:{id}` list.
They are atomically moved between these sets as they are claimed and returned.

Periodically, each worker in the pool looks at all the `accounts:{id}` lists.
For each list it finds, it checks for the existence of `heartbeat:{id}`, a key
that expires quickly if the sync process doesn't refresh it.

If it does not find the key, it moves all of the accounts in the list back to
the unclaimed key.

Sync processes only claim an account for a fixed period of time. This means that
an engineer can add new sync machines to the pool and the load across instances
will balance on it's own. It also means one bad instance will not permanently
disrupt sync for any accounts. (Eg: instance has faulty network connection.)

Sync processes periodically claim accounts when they can find them, regardless
of how busy they are. A separate API (`/routes/monitoring`) allows CloudWatch
to decide whether to spin up instances or take them offline based on CPU/RAM
utilization across the pool.
*/

class SyncProcessManager {
  constructor() {
    this._workers = {};
    this._exiting = false;
    this._accounts = []
    this._logger = global.Logger.child();

    Actions.wakeLocalSyncWorkerForAccount.listen((accountId) =>
      this.wakeWorkerForAccount(accountId)
    )
  }

  /**
   * Useful for debugging.
   */
  async start() {
    this._logger.info(`ProcessManager: Starting with ID`)

    const {Account} = await LocalDatabaseConnector.forShared();
    const accounts = await Account.findAll();
    for (const account of accounts) {
      this.addWorkerForAccount(account);
    }
  }

  accounts() { return this._accounts }
  workers() { return _.values(this._workers) }
  dbs() { return this.workers().map(w => w._db) }

  wakeWorkerForAccount(accountId, {reason = 'Waking sync', interrupt} = {}) {
    const worker = this._workers[accountId]
    if (worker) {
      worker.syncNow({reason, interrupt});
    }
  }

  async addWorkerForAccount(account) {
    await LocalDatabaseConnector.ensureAccountDatabase(account.id);

    try {
      const db = await LocalDatabaseConnector.forAccount(account.id);
      if (this._workers[account.id]) {
        throw new Error("Local worker already exists");
      }
      this._accounts.push(account)
      this._workers[account.id] = new SyncWorker(account, db, this);
      this._logger.info({account_id: account.id}, `ProcessManager: Claiming Account Succeeded`)
    } catch (err) {
      this._logger.error({account_id: account.id, reason: err.message}, `ProcessManager: Claiming Account Failed`)
    }
  }

  removeWorkerForAccountId(accountId) {
    if (this._workers[accountId]) {
      this._workers[accountId].cleanup();
      this._workers[accountId] = null;
    }
  }
}

window.syncProcessManager = new SyncProcessManager();
window.dbs = window.syncProcessManager.dbs.bind(window.syncProcessManager)
module.exports = window.syncProcessManager
