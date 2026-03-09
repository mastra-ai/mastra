import Fastify from 'fastify';
import {rootLogger} from './logger';
import healthchecks from './fastify/controllers/healthchecks';
import mastraPlugin from './fastify/plugins/mastra';
import demoController from '../apps/demo/controller';

async function createApp() {
  const fastify = Fastify({
    loggerInstance: rootLogger,
    requestIdHeader: 'x-request-id',
    /**
     * @see https://github.com/envoyproxy/envoy/issues/1979
     */
    keepAliveTimeout: 0,
    bodyLimit: 1048576 * 10, // 10MiB
    disableRequestLogging: true,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
  });
  await fastify.register(mastraPlugin);
  await fastify.register(healthchecks);
  await fastify.register(demoController, {
    prefix: '/demo',
  });

  return fastify;
}

export default createApp;
