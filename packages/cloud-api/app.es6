// Super light-weight Flask-like server. Easier than express
// https://github.com/hapijs/hapi
import Hapi from 'hapi';

// Static file and directory handlers for hapi.js
// https://github.com/hapijs/inert
import Inert from 'inert';

// Templates rendering support for hapi.js
// https://github.com/hapijs/vision
import Vision from 'vision';

// HTTP-friendly error objects
// https://github.com/hapijs/boom
import HapiBoom from 'hapi-boom-decorators'

// Open API Swagger specs:
// https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md
// https://github.com/glennjones/hapi-swagger
import HapiSwagger from 'hapi-swagger';

// Basic API user:pass Authentication
// https://github.com/hapijs/hapi-auth-basic
import HapiBasicAuth from 'hapi-auth-basic';

import {Logger, Metrics} from 'cloud-core';

import Package from './package.json';
import {apiAuthenticate} from './src/authentication'

/**
 * API Routes
 */
import registerAuthRoutes from './src/routes/auth'
import registerPingRoutes from './src/routes/ping'
import registerDeltaRoutes from './src/routes/delta'
import registerMetadataRoutes from './src/routes/metadata'
import registerHoneycombRoutes from './src/routes/honeycomb'
import registerLinkTrackingRoutes from './src/routes/link-tracking'
import registerOpenTrackingRoutes from './src/routes/open-tracking'

/**
 * API Decorators
 */
import registerLoggerDecorator from './src/decorators/logger'
import registerErrorFormatDecorator from './src/decorators/error-format'

Metrics.startCapturing('nylas-k2-api')

global.Metrics = Metrics
global.Logger = Logger.createLogger('nylas-k2-api')

const onUnhandledError = (err) => {
  global.Logger.fatal(err, 'Unhandled error')
  global.Metrics.reportError(err)
}
process.on('uncaughtException', onUnhandledError)
process.on('unhandledRejection', onUnhandledError)

const server = new Hapi.Server({
  debug: { request: ['error'] },
  connections: {
    router: {
      stripTrailingSlash: true,
    },
  },
});

server.connection({ port: process.env.PORT });

const plugins = [Inert, Vision, HapiBasicAuth, HapiBoom, {
  register: HapiSwagger,
  options: {
    info: {
      title: 'N1-Cloud API Documentation',
      version: Package.version,
    },
  },
}];

server.register(plugins, (err) => {
  if (err) { throw err; }

  registerAuthRoutes(server)
  registerPingRoutes(server)
  registerDeltaRoutes(server)
  registerMetadataRoutes(server)
  registerHoneycombRoutes(server)
  registerLinkTrackingRoutes(server)
  registerOpenTrackingRoutes(server)

  registerLoggerDecorator(server)
  registerErrorFormatDecorator(server)

  server.auth.strategy('api-consumer', 'basic', {
    validateFunc: apiAuthenticate,
  });
  server.auth.default('api-consumer');

  server.start((startErr) => {
    if (startErr) { throw startErr; }
    global.Logger.info({url: server.info.uri}, 'API running');
  });
});
