import Fastify from 'fastify';

import {rootLogger} from './logger';
import healthchecks from './fastify/controllers/healthchecks';
import mastraApi from './fastify/controllers/mastra-api';
import mastraPlugin from './fastify/plugins/mastra';
import copilotkit from './fastify/controllers/copilotkit';

import cors from '@fastify/cors';
import config from 'config';
import demoController from '../apps/demo/controller';

const serverConfig = config.get<{cors: boolean}>('server');

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

  if (serverConfig.cors) {
    await fastify.register(cors, {
      origin: '*',
      allowedHeaders: ['*'],
    });
  }

  await fastify.register(healthchecks);
  await fastify.register(mastraApi);
  await fastify.register(copilotkit);
  await fastify.register(demoController, {
    prefix: '/demo',
  });

  return fastify;
}

export default createApp;
