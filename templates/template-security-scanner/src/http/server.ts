import { serve } from '@hono/node-server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Server } from 'node:http';
import { RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { createMastra } from '../mastra/index.js';
import { preflight } from '../runtime/docker.js';
import { prepareDataDirectory } from '../runtime/files.js';

export async function initializeStorage(settings: Settings) {
  await prepareDataDirectory(settings);
  const file = await open(settings.databasePath, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.()) {
      throw new RuntimeDiagnostic('UNSAFE_DATABASE', 'Use an owned regular file for the local database.');
    }
    await file.chmod(0o600);
  } finally {
    await file.close();
  }
  const runtime = createMastra(settings);
  try {
    await runtime.storage.init();
  } catch (error) {
    await runtime.storage.close();
    throw error;
  }
  return runtime;
}

function closeListener(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
    server.closeIdleConnections();
  });
}

export async function startLocalServer(settings: Settings, port = settings.PORT) {
  await preflight(settings);
  const { mastra, storage } = await initializeStorage(settings);
  const app = new Hono();
  let boundPort = port;
  // Register outside adapter middleware so framework-public routes cannot skip this boundary.
  app.use('*', async (context, next) => {
    const authority = `127.0.0.1:${boundPort}`;
    const origin = context.req.header('origin');
    if (context.req.header('host') !== authority || (origin !== undefined && origin !== `http://${authority}`)) {
      return context.json({ code: 'LOCAL_ORIGIN_REQUIRED' }, 403);
    }
    if (context.req.method !== 'GET' || context.req.path !== '/api/runtime') {
      return context.json({ code: 'EXECUTION_DISABLED' }, 403);
    }
    await next();
  });
  app.get('/api/runtime', context =>
    context.json({ status: 'diagnostics-only', scanningEnabled: false, nativeExecutionEnabled: false }),
  );
  let listener: Server | undefined;
  try {
    const adapter = new MastraServer({
      app,
      mastra,
      prefix: '/native',
      bodyLimitOptions: { maxSize: 16384, onError: () => ({ code: 'BODY_TOO_LARGE' }) },
    });
    await adapter.init();
    await new Promise<void>((resolve, reject) => {
      listener = serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, address => {
        boundPort = address.port;
        resolve();
      }) as Server;
      listener.once('error', reject);
    });
    // Adapter init installs routes; workers start only after the listener is ready.
    await mastra.startWorkers();
    return {
      url: `http://127.0.0.1:${boundPort}`,
      mastra,
      storage,
      close: async () => {
        const results = await Promise.allSettled([closeListener(listener!), mastra.shutdown()]);
        await storage.close();
        if (results.some(result => result.status === 'rejected')) {
          throw new RuntimeDiagnostic('SERVER_CLEANUP_FAILED', 'The local listener or workers did not stop cleanly.');
        }
      },
    };
  } catch (error) {
    const cleanup = await Promise.allSettled([
      ...(listener?.listening ? [closeListener(listener)] : []),
      mastra.shutdown(),
    ]);
    try {
      await storage.close();
    } catch {
      throw new RuntimeDiagnostic('SERVER_CLEANUP_FAILED', 'Local startup failed and the database did not close.');
    }
    if (cleanup.some(result => result.status === 'rejected'))
      throw new RuntimeDiagnostic('SERVER_CLEANUP_FAILED', 'Local startup failed and cleanup needs attention.');
    throw error;
  }
}
