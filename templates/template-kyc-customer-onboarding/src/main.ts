import { serve } from '@hono/node-server';

import { loadConfig } from './config/load-config.js';
import { createDependencies } from './create-dependencies.js';
import { createGracefulShutdown, drainMastraObservability } from './lifecycle/graceful-shutdown.js';
import { createServer } from './server/create-server.js';

const config = loadConfig();
const dependencies = await createDependencies(config);
const app = await createServer(dependencies);

const server = serve({
  fetch: app.fetch,
  hostname: config.server.host,
  port: config.server.port,
});

const shutdown = createGracefulShutdown({
  stopServer: () =>
    new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error === undefined) resolve();
        else reject(error);
      });
    }),
  forceStopServer: () => {
    if ('closeAllConnections' in server) {
      server.closeAllConnections();
      return;
    }
    throw new Error('Server does not support force-closing active connections');
  },
  drainObservability: () => drainMastraObservability(dependencies.mastra.observability),
  closeStorage: dependencies.storage.close,
  operationTimeoutMs: 5_000,
});

const handleSignal = (): void => {
  void shutdown().catch(() => {
    process.exitCode = 1;
    console.error('Graceful shutdown failed');
  });
};

process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
