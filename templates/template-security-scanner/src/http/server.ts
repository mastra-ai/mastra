import { serve } from '@hono/node-server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { parse } from '../core/contracts.js';
import type { Server } from 'node:http';
import { hasMorphApiKey, RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { createMastra } from '../mastra/index.js';
import { DomainStore } from '../core/store.js';
import { CredentialVault } from '../core/credentials.js';
import { ControlPlane } from '../core/control-plane.js';
import type { IdentityTransport } from '../core/identity.js';
import { OPERATOR_ID, protectControlPlane, readJson } from './security.js';
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
import { AdvisoryTriage, MastraAdvisoryModels, type AdvisoryModels } from '../advisory/triage.js';
import { registerIntelligenceRoutes } from './intelligence-routes.js';
import { InvestigationService } from '../investigation/service.js';
import { registerInvestigationRoutes } from './investigation-routes.js';
import { registerConsoleRoutes } from './console-routes.js';
import { MastraInvestigationModels, type InvestigationModels } from '../investigation/models.js';
import { OwnedGatewayVerifier } from '../investigation/driver.js';
import { AdvisoryScheduler } from '../advisory/schedule.js';
import { prepareDataDirectory } from '../runtime/files.js';
import { operationStatus, recoverInterruptedRestore } from '../runtime/operations.js';
import { BolaAssessmentService } from '../investigation/bola-service.js';
import { BolaGatewayDriver, type BolaImageBuildHook, type BolaVerificationHook } from '../investigation/bola-driver.js';
import { MastraBolaModels, type BolaModels } from '../investigation/bola-models.js';
import { registerBolaRoutes } from './bola-routes.js';

/** Prepare separate domain and native Mastra storage before the control plane starts. */
export async function initializeStorage(
  settings: Settings,
  processDue?: () => Promise<void>,
  processAdvisoryDue?: () => Promise<void>,
) {
  await prepareStorageFiles(settings);
  const runtime = createMastra(settings, processDue, processAdvisoryDue);
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

/** Start the protected local Hono/Mastra server and return its draining shutdown operation. */
export async function startControlPlane(
  settings: Settings,
  port = settings.PORT,
  identityTransport?: IdentityTransport,
  ownedLab?: OwnedLabBoundary,
  advisorySource?: AdvisorySource,
  investigationModels?: InvestigationModels,
  bolaModels?: BolaModels,
  bolaVerificationHook?: BolaVerificationHook,
  bolaImageBuildHook?: BolaImageBuildHook,
  advisoryModels?: AdvisoryModels,
) {
  if (settings.SCANNER_INVESTIGATION_ENABLED && !investigationModels && !bolaModels && !hasMorphApiKey())
    throw new RuntimeDiagnostic('MORPH_API_KEY_REQUIRED', 'Set MORPH_API_KEY before enabling investigation models.');
  let investigations: InvestigationService | undefined;
  let assessments: BolaAssessmentService | undefined;
  let advisoryScheduler: AdvisoryScheduler | undefined;
  await prepareDataDirectory(settings);
  const releaseInstance = await acquireInstance(settings);
  let runtime: Awaited<ReturnType<typeof initializeStorage>>;
  try {
    await recoverInterruptedRestore(settings);
    runtime = await initializeStorage(
      settings,
      async () => {
        if (settings.SCANNER_INVESTIGATION_ENABLED && investigations)
          await investigations.processSchedules(OPERATOR_ID);
      },
      async () => {
        await advisoryScheduler?.runDue();
      },
    );
  } catch (error) {
    await releaseInstance();
    throw error;
  }
  const { mastra, storage, agents } = runtime;
  const domainStore = new DomainStore(settings.databaseUrl);
  const catalog = new ReferenceCatalog(settings.databaseUrl);
  const playbooks = new PlaybookRegistry(catalog);
  const advisoryStore = new AdvisoryStore(settings.databaseUrl);
  const advisory = new AdvisorySync(advisoryStore, advisorySource ?? new AdvisorySource());
  const advisoryTriage = new AdvisoryTriage(
    settings.databaseUrl,
    advisoryStore,
    domainStore,
    advisoryModels ?? (agents ? new MastraAdvisoryModels(agents.sherlock, settings.EXPLORER_MODEL) : undefined),
  );
  advisoryScheduler = new AdvisoryScheduler(settings, advisory, async () => {
    await advisoryTriage.planNew(OPERATOR_ID);
    if (settings.SCANNER_INVESTIGATION_ENABLED) await investigations?.processSchedules(OPERATOR_ID);
  });
  const app = new Hono();
  let boundPort = port;
  const protection = protectControlPlane(
    app,
    () => `127.0.0.1:${boundPort}`,
    settings.CONTROL_BOOTSTRAP_SECRET,
    settings.CONTROL_SESSION_TTL_SECONDS,
  );
  let scans: ScanService | undefined;
  const service = new ControlPlane(
    domainStore,
    new CredentialVault(settings.SCANNER_ENCRYPTION_KEY),
    identityTransport,
    async (scope, validate, commit) =>
      scans
        ? scans.coordinateMutation(scope, validate, () =>
            investigations
              ? investigations.coordinateMutation(
                  scope,
                  async () => undefined,
                  () => (assessments ? assessments.coordinateMutation(scope, async () => undefined, commit) : commit()),
                )
              : commit(),
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
  assessments = new BolaAssessmentService(
    scans.store,
    service,
    scans,
    new BolaGatewayDriver(settings, service, scans.store, ownedLab, bolaVerificationHook, bolaImageBuildHook),
    bolaModels ?? (agents ? new MastraBolaModels(agents, settings.EXPLORER_MODEL, settings.JUDGE_MODEL) : undefined),
  );
  registerDomainRoutes(app, service, scans);
  registerIntelligenceRoutes(app, catalog, playbooks, advisory, advisoryTriage, () =>
    investigations!.processSchedules(OPERATOR_ID),
  );
  registerInvestigationRoutes(app, investigations, settings.SCANNER_INVESTIGATION_ENABLED);
  registerBolaRoutes(app, assessments);
  app.get('/api/advisory-schedule', async context => context.json(await advisoryStore.scheduleStatus()));
  app.post('/api/advisory-schedule/pause', async context => {
    const { paused, revision } = parse(
      z.object({ paused: z.boolean(), revision: z.number().int().positive().safe() }).strict(),
      await readJson(context.req),
    );
    return context.json(await advisoryStore.pauseSchedule(paused, revision));
  });
  await registerConsoleRoutes(app, settings, investigations, service, assessments);
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
  app.get('/api/operations', async context =>
    context.json({
      operation: await operationStatus(settings),
      retention: await scans!.store.retentionStatus(),
      imageRecordsPending: (await scans!.store.resourceSummary()).image ?? 0,
    }),
  );
  let listener: Server | undefined;
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = () =>
    (shutdownPromise ??= (async () => {
      protection.close();
      const stoppedListener = await Promise.allSettled([
        listener?.listening ? closeListener(listener) : Promise.resolve(),
      ]);
      const stoppedInvestigations = await Promise.allSettled([assessments.close(), investigations.close()]);
      const stoppedAdvisory = await Promise.allSettled([
        advisoryScheduler!.close(),
        advisory.close(),
        advisoryTriage.close(),
      ]);
      const critical = [
        ...stoppedListener,
        ...stoppedInvestigations,
        ...stoppedAdvisory,
        ...(await Promise.allSettled([scans!.close(), mastra.shutdown()])),
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
    await domainStore.initialize();
    await catalog.initialize();
    await playbooks.initialize();
    await advisoryStore.initialize();
    await advisoryTriage.initialize();
    await advisoryScheduler.initialize();
    await scans.initialize();
    await investigations.initialize();
    await assessments.initialize(OPERATOR_ID);
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
    await advisoryScheduler.runDue();
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
