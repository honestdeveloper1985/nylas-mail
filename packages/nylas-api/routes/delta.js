const Rx = require('rx')
const _ = require('underscore');
const {PubsubConnector} = require(`nylas-core`);

function keepAlive(request) {
  const until = Rx.Observable.fromCallback(request.on)("disconnect")
  return Rx.Observable.interval(1000).map(() => "\n").takeUntil(until)
}

function inflateTransactions(db, transactionModels = []) {
  const transactions = _.pluck(transactionModels, "dataValues")
  const byModel = _.groupBy(transactions, "modelName");
  const byObjectIds = _.groupBy(transactions, "objectId");

  return Promise.all(Object.keys(byModel).map((modelName) => {
    const ids = _.pluck(byModel[modelName], "objectId");
    const modelConstructorName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
    const ModelKlass = db[modelConstructorName]
    let includes = [];
    if (ModelKlass.requiredAssociationsForJSON) {
      includes = ModelKlass.requiredAssociationsForJSON()
    }
    return ModelKlass.findAll({where: {id: ids}, include: includes})
    .then((models = []) => {
      for (const model of models) {
        const tsForId = byObjectIds[model.id];
        if (!tsForId || tsForId.length === 0) { continue; }
        for (const t of tsForId) { t.object = model; }
      }
    })
  })).then(() => transactions)
}

function createOutputStream() {
  const outputStream = require('stream').Readable();
  outputStream._read = () => { return };
  outputStream.pushJSON = (msg) => {
    const jsonMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
    outputStream.push(jsonMsg);
  }
  return outputStream
}

function initialTransactions(db, request) {
  const getParams = request.query || {}
  const since = new Date(getParams.since || Date.now())
  return db.Transaction
           .streamAll({where: {createdAt: {$gte: since}}})
           .flatMap((objs) => inflateTransactions(db, objs))
}

module.exports = (server) => {
  server.route({
    method: 'GET',
    path: '/delta/streaming',
    handler: (request, reply) => {
      const outputStream = createOutputStream();
      const account = request.auth.credentials;

      request.getAccountDatabase().then((db) => {
        const source = Rx.Observable.merge(
          PubsubConnector.observeDeltas(account.id),
          initialTransactions(db, request),
          keepAlive(request)
        ).subscribe(outputStream.pushJSON)

        request.on("disconnect", () => {
          source.dispose()
        });
      });

      reply(outputStream)
    },
  });
};
