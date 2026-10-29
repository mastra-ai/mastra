import { serve } from '@hono/node-server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Server } from 'node:http';
import { RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { createMastra } from '../mastra/index.js';
import { DomainStore } from '../core/store.js';
import { CredentialVault } from '../core/credentials.js';
import { ControlPlane } from '../core/control-plane.js';
import type { IdentityTransport } from '../core/identity.js';
import { protectControlPlane } from './security.js';
import { registerDomainRoutes } from './routes.js';
import { preflight } from '../runtime/docker.js';
import { prepareDataDirectory } from '../runtime/files.js';
import { acquireInstance } from '../discovery/instance.js';
import { ScanService } from '../discovery/service.js';
import type { OwnedLabBoundary } from '../discovery/driver.js';
import { requireDiscoveryCapability } from '../discovery/capability.js';

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
    server.closeAllConnections();
  });
}

export async function startLocalServer(settings: Settings, port = settings.PORT) {
  await preflight(settings);
  return startControlPlane(settings, port);
}

export async function startControlPlane(
  settings: Settings,
  port = settings.PORT,
  identityTransport?: IdentityTransport,
  ownedLab?: OwnedLabBoundary,
) {
  const { mastra, storage } = await initializeStorage(settings);
  const domainStore = new DomainStore(settings.databaseUrl);
  const app = new Hono();
  let boundPort = port;
  const protection = protectControlPlane(
    app,
    () => `127.0.0.1:${boundPort}`,
    settings.CONTROL_BOOTSTRAP_SECRET,
    settings.CONTROL_SESSION_TTL_SECONDS,
  );
  let scans: ScanService | undefined;
  let releaseInstance: (() => Promise<void>) | undefined;
  const service = new ControlPlane(
    domainStore,
    new CredentialVault(settings.SCANNER_ENCRYPTION_KEY),
    identityTransport,
    async (scope, validate, commit) =>
      scans ? scans.coordinateMutation(scope, validate, commit) : (await validate(), commit()),
  );
  scans = new ScanService(settings, service, ownedLab);
  registerDomainRoutes(app, service, scans);
  app.get('/api/runtime', async context => {
    let scanningEnabled = false;
    if (settings.SCANNER_DISCOVERY_ENABLED)
      try {
        await requireDiscoveryCapability(settings, 'http');
        scanningEnabled = true;
      } catch {}
    return context.json({
      status: settings.CONTROL_BOOTSTRAP_SECRET ? 'control-plane' : 'diagnostics-only',
      scanningEnabled,
      discoveryRequested: settings.SCANNER_DISCOVERY_ENABLED,
      nativeExecutionEnabled: false,
    });
  });
  let listener: Server | undefined;
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = () =>
    (shutdownPromise ??= (async () => {
      protection.close();
      const critical = await Promise.allSettled([
        listener?.listening ? closeListener(listener) : Promise.resolve(),
        scans!.close(),
        mastra.shutdown(),
      ]);
      const stores = await Promise.allSettled([Promise.resolve().then(() => domainStore.close()), storage.close()]);
      // A failed scan cleanup keeps the live-PID instance fence in place. After
      // process exit, the next owner may reconcile its exact persisted resources.
      const fence = critical.every(result => result.status === 'fulfilled')
        ? await Promise.allSettled([releaseInstance?.()])
        : [];
      if ([...critical, ...stores, ...fence].some(result => result.status === 'rejected'))
        throw new RuntimeDiagnostic(
          'SERVER_CLEANUP_FAILED',
          'Local shutdown was attempted for every component; cleanup debt requires attention.',
        );
    })());
  try {
    releaseInstance = await acquireInstance(settings);
    await domainStore.initialize();
    await scans.initialize();
    const adapter = new MastraServer({
      app,
      mastra,
      prefix: '/native',
      openapiPath: '/openapi.json',
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
      close: shutdown,
    };
  } catch (error) {
    try {
      await shutdown();
    } catch {
      throw new RuntimeDiagnostic(
        'SERVER_CLEANUP_FAILED',
        'Local startup failed; all independent cleanup stages were attempted.',
      );
    }
    throw error;
  }
}
