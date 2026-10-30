import { serve } from '@hono/node-server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import type { Server } from 'node:http';
import { hasMorphApiKey, RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { createMastra } from '../mastra/index.js';
import { DomainStore } from '../core/store.js';
import { CredentialVault } from '../core/credentials.js';
import { ControlPlane } from '../core/control-plane.js';
import type { IdentityTransport } from '../core/identity.js';
import { OPERATOR_ID, protectControlPlane } from './security.js';
import { registerDomainRoutes } from './routes.js';
import { preflight } from '../runtime/docker.js';
import { prepareStorageFiles } from '../runtime/storage-files.js';
import { acquireInstance } from '../discovery/instance.js';
import { ScanService } from '../discovery/service.js';
import type { OwnedLabBoundary } from '../discovery/driver.js';
import { requireDiscoveryCapability } from '../discovery/capability.js';
import { ReferenceCatalog } from '../knowledge/catalog.js';
import { PlaybookRegistry } from '../knowledge/playbooks.js';
import { AdvisoryStore } from '../advisory/store.js';
import { AdvisorySource } from '../advisory/source.js';
import { AdvisorySync } from '../advisory/sync.js';
import { registerIntelligenceRoutes } from './intelligence-routes.js';
import { InvestigationService } from '../investigation/service.js';
import { registerInvestigationRoutes } from './investigation-routes.js';
import { MastraInvestigationModels, type InvestigationModels } from '../investigation/models.js';
import { OwnedGatewayVerifier } from '../investigation/driver.js';

export async function initializeStorage(settings: Settings, processDue?: () => Promise<void>) {
  await prepareStorageFiles(settings);
  const runtime = createMastra(settings, processDue);
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
  advisorySource?: AdvisorySource,
  investigationModels?: InvestigationModels,
) {
  if (settings.SCANNER_INVESTIGATION_ENABLED && !investigationModels && !hasMorphApiKey())
    throw new RuntimeDiagnostic('MORPH_API_KEY_REQUIRED', 'Set MORPH_API_KEY before enabling investigation models.');
  let investigations: InvestigationService | undefined;
  const { mastra, storage, agents } = await initializeStorage(settings, async () => {
    if (settings.SCANNER_INVESTIGATION_ENABLED && investigations) await investigations.processSchedules(OPERATOR_ID);
  });
  const domainStore = new DomainStore(settings.databaseUrl);
  const catalog = new ReferenceCatalog(settings.databaseUrl);
  const playbooks = new PlaybookRegistry(catalog);
  const advisoryStore = new AdvisoryStore(settings.databaseUrl);
  const advisory = new AdvisorySync(advisoryStore, advisorySource ?? new AdvisorySource());
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
      scans
        ? scans.coordinateMutation(scope, validate, () =>
            investigations ? investigations.coordinateMutation(scope, async () => undefined, commit) : commit(),
          )
        : (await validate(), commit()),
  );
  scans = new ScanService(settings, service, ownedLab);
  const models =
    investigationModels ??
    (agents ? new MastraInvestigationModels(agents, settings.EXPLORER_MODEL, settings.JUDGE_MODEL) : undefined);
  const verifier = new OwnedGatewayVerifier(settings, service, scans.store, ownedLab);
  investigations = new InvestigationService(
    settings.databaseUrl,
    service,
    scans,
    playbooks,
    advisoryStore,
    ownedLab,
    models,
    verifier,
    settings.SCANNER_INVESTIGATION_ENABLED,
  );
  registerDomainRoutes(app, service, scans);
  registerIntelligenceRoutes(app, catalog, playbooks, advisory, () => investigations!.processSchedules(OPERATOR_ID));
  registerInvestigationRoutes(app, investigations, settings.SCANNER_INVESTIGATION_ENABLED);
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
      const stoppedListener = await Promise.allSettled([
        listener?.listening ? closeListener(listener) : Promise.resolve(),
      ]);
      const stoppedInvestigations = await Promise.allSettled([investigations.close()]);
      const critical = [
        ...stoppedListener,
        ...stoppedInvestigations,
        ...(await Promise.allSettled([scans!.close(), advisory.close(), mastra.shutdown()])),
      ];
      const stores = await Promise.allSettled([
        Promise.resolve().then(() => domainStore.close()),
        Promise.resolve().then(() => catalog.close()),
        Promise.resolve().then(() => advisoryStore.close()),
        storage.close(),
      ]);
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
    await catalog.initialize();
    await playbooks.initialize();
    await advisoryStore.initialize();
    await scans.initialize();
    await investigations.initialize();
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
    if (settings.SCANNER_INVESTIGATION_ENABLED) {
      investigations.startWorkers(OPERATOR_ID);
      await investigations.processSchedules(OPERATOR_ID);
    }
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
