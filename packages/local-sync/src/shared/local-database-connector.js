const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const {loadModels, PromiseUtils, HookIncrementVersionOnSave, HookTransactionLog} = require('isomorphic-core');
const TransactionConnector = require('./transaction-connector')

require('./database-extensions'); // Extends Sequelize on require

class LocalDatabaseConnector {
  constructor() {
    this._cache = {};
  }

  _sequelizePoolForDatabase(dbname) {
    return new Sequelize(dbname, '', '', {
      storage: path.join(process.env.NYLAS_HOME, `${dbname}.sqlite`),
      dialect: "sqlite",
      logging: false,
    })
  }

  forAccount(accountId) {
    if (!accountId) {
      return Promise.reject(new Error(`You need to pass an accountId to init the database!`))
    }

    if (this._cache[accountId]) {
      return this._cache[accountId];
    }

    const newSequelize = this._sequelizePoolForDatabase(`a-${accountId}`);
    const db = loadModels(Sequelize, newSequelize, {
      modelDirs: [path.resolve(__dirname, '..', 'models')],
    })

    HookTransactionLog(db, newSequelize, {
      onCreatedTransaction: (transaction) => {
        TransactionConnector.notifyDelta(db.accountId, transaction);
      },
    });

    HookIncrementVersionOnSave(db, newSequelize);

    db.sequelize = newSequelize;
    db.Sequelize = Sequelize;
    db.accountId = accountId;

    this._cache[accountId] = newSequelize.authenticate().thenReturn(db);

    return this._cache[accountId];
  }

  ensureAccountDatabase(accountId) {
    return this.forAccount(accountId).then((db) => {
      // this is a bit of a hack, because sequelize.sync() doesn't work with
      // schemas. It's necessary to sync models individually and in the right order.
      const models = ['Contact', 'Folder', 'Label', 'Transaction', 'Thread', 'ThreadLabel', 'ThreadFolder', 'Message', 'MessageLabel', 'File', 'SyncbackRequest'];
      return PromiseUtils.each(models, (n) =>
        db[n].sync()
      )
    });
  }

  destroyAccountDatabase(accountId) {
    const dbname = `a-${accountId}`;
    const dbpath = path.join(process.env.NYLAS_HOME, `${dbname}.sqlite`);

    const err = fs.accessSync(dbpath, fs.F_OK);
    if (!err) {
      fs.unlinkSync(dbpath);
    }

    delete this._cache[accountId];
    return Promise.resolve()
  }

  _sequelizeForShared() {
    const sequelize = this._sequelizePoolForDatabase(`shared`);
    const db = loadModels(Sequelize, sequelize)

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;

    return sequelize.authenticate().then(() =>
      sequelize.sync()
    ).thenReturn(db);
  }

  forShared() {
    this._cache.shared = this._cache.shared || this._sequelizeForShared();
    return this._cache.shared;
  }
}

module.exports = new LocalDatabaseConnector()
