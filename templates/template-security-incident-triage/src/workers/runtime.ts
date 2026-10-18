import { serve } from '@hono/node-server';
import type { Mastra } from '@mastra/core/mastra';
import type { PubSub } from '@mastra/core/events';

import { createLibSqlOperationalStore } from '../db/libsql-operational-store.js';
import { migrateOperationalStore } from '../db/migrate.js';
import { purgeExpiredGeoIpCache } from '../db/geoip-cache-operations.js';
import { startRetentionScheduler, type RetentionScheduler } from './retention-scheduler.js';
import { readRetentionSchedulerConfig, type RetentionSchedulerConfig } from '../config/retention.js';
import type { OperationalStore } from '../db/operational-store.js';
import {
  readServerConfig,
  readIntegrationConfig,
  readApprovalConfig,
  readDashboardConfig,
  type ServerConfig,
  type IntegrationConfig,
  type ApprovalConfig,
  type DashboardConfig,
  type AgentConfig,
  readAgentConfig,
} from '../env.js';
import { consoleLogger, type StructuredLogger } from '../logging.js';
import { createApp } from '../server.js';
import { createIncidentProvider } from '../providers/runtime-factory.js';
import { createIdentityProvider } from '../providers/runtime-factory.js';
import { OutboxDispatcher } from './outbox-dispatcher.js';
import { startWorkflowWorker, type IngestionWorkflow } from './workflow-worker.js';
import { ApprovalRecoveryWorker } from './approval-recovery-worker.js';
import { createWorkflowApprovalRunReconciler, type ApprovalWorkflow } from '../approval/workflow-resume-reconciler.js';
import { bootstrapRunbookKnowledge } from '../mastra/knowledge/bootstrap.js';
import { InProcessDomainPubSub } from './in-process-domain-pubsub.js';
import { DomainError } from '../domain/errors.js';

export type ServerRuntime = Readonly<{
  port: number;
  stop(): Promise<void>;
}>;

type BoundServer = Readonly<{ port: number; close(): Promise<void> }>;
type BindServer = (
  fetch: (request: Request) => Response | Promise<Response>,
  port: number,
  hostname: string,
) => Promise<BoundServer>;
type MastraRuntimeModule = Readonly<{
  createRuntimeMastra(config: AgentConfig, options?: Readonly<{ integrationConfig: IntegrationConfig }>): Mastra;
  createDomainEventPubSub(): PubSub;
  storage: Readonly<{ init(): void | Promise<void> }>;
}>;

export async function startServerRuntime(
  overrides: Readonly<{
    config?: ServerConfig;
    store?: OperationalStore;
    logger?: StructuredLogger;
    port?: number;
    mastraInstance?: Mastra;
    /** Domain-event transport; kept separate from Mastra orchestration PubSub. */
    domainEventPubSub?: PubSub;
    /** Initializes the shared Mastra storage before operational migrations. */
    initializeStorage?: () => void | Promise<void>;
    bindServer?: BindServer;
    approvalConfig?: ApprovalConfig;
    dashboardConfig?: DashboardConfig;
    /** A validated agent model/timeouts config is injected into Mastra assembly. */
    agentConfig?: AgentConfig;
    /** Test seam proving validation precedes the deferred Mastra module load. */
    loadMastraRuntime?: () => Promise<MastraRuntimeModule>;
    /** A validated integration config is injected once into every runtime boundary. */
    integrationConfig?: IntegrationConfig;
    retentionConfig?: RetentionSchedulerConfig;
  }> = {},
): Promise<ServerRuntime> {
  const config = overrides.config ?? readServerConfig();
  // agent is intentionally parsed before the runtime dynamically imports the
  // Mastra graph (which can construct providers) or opens any local store.
  const agentConfig = overrides.agentConfig ?? readAgentConfig();
  const integrationConfig = overrides.integrationConfig ?? readIntegrationConfig();
  // Parse every runtime boundary before any store creation, storage init,
  // migration, scheduler, or provider side effect. Overrides are prevalidated
  // test/embedding contracts and preserve that already-validated injection.
  const approvalConfig = overrides.approvalConfig ?? readApprovalConfig();
  const dashboardConfig = overrides.dashboardConfig ?? readDashboardConfig();
  const retentionConfig = overrides.retentionConfig ?? readRetentionSchedulerConfig();
  const store = overrides.store ?? createLibSqlOperationalStore();
  const logger = overrides.logger ?? consoleLogger;
  const runtimeModule = overrides.mastraInstance
    ? undefined
    : await (overrides.loadMastraRuntime ?? (() => import('../mastra/runtime.js')))();
  const runtimeMastra =
    overrides.mastraInstance ?? runtimeModule!.createRuntimeMastra(agentConfig, { integrationConfig });
  const domainEventPubSub =
    overrides.domainEventPubSub ?? runtimeModule?.createDomainEventPubSub() ?? new InProcessDomainPubSub();
  const ownsDomainEventPubSub = domainEventPubSub !== runtimeMastra.pubsub;
  const initializeStorage =
    overrides.initializeStorage ?? (runtimeModule ? () => runtimeModule.storage.init() : async () => undefined);
  let unsubscribe: (() => Promise<void>) | undefined;
  let timer: NodeJS.Timeout | undefined;
  let server: BoundServer | undefined;
  let iteration: Promise<unknown> | undefined;
  let retentionScheduler: RetentionScheduler | undefined;
  let stopped = false;
  let backgroundFailureCount = 0;
  let backgroundRetryAfter = 0;
  try {
    await initializeStorage();
    await migrateOperationalStore(store);
    // An injected store owns its runbook authority. Local and staging startup
    // bootstrap checked-in knowledge for a one-command environment; production
    // uses the separately reviewed `runbooks:index` release operation.
    if (!overrides.store && integrationConfig.mode !== 'production') await bootstrapRunbookKnowledge(store);
    retentionScheduler = await startRetentionScheduler(store, retentionConfig, logger);
    const app = await createApp({
      config,
      store,
      logger,
      mastraInstance: runtimeMastra,
      approvalConfig,
      dashboardConfig,
      integrationConfig,
    });
    await runtimeMastra.startWorkers();
    unsubscribe = await startWorkflowWorker({
      pubsub: domainEventPubSub,
      workflow: (runtimeMastra.getWorkflow as (name: string) => unknown)(
        'securityIncidentWorkflow',
      ) as IngestionWorkflow,
      store,
      logger,
      maxAttempts: config.outbox.maxAttempts,
    });
    const dispatcher = new OutboxDispatcher(store, domainEventPubSub, config.outbox, logger);
    const approvalWorkflow = (runtimeMastra.getWorkflow as (id: string) => unknown)(
      'securityIncidentWorkflow',
    ) as ApprovalWorkflow;
    const recovery = new ApprovalRecoveryWorker({
      store,
      provider: createIncidentProvider(integrationConfig, { store }),
      containmentState: {
        sessions: new Map(),
        roles: new Map(),
        devices: new Map(),
        reauthentication: new Map(),
        calls: new Map(),
      },
      mode: approvalConfig.mode,
      actionTimeoutMs: approvalConfig.actionTimeoutMs,
      rateLimit: approvalConfig.rateLimit,
      identityProvider: createIdentityProvider(integrationConfig, () => true, {
        openStore: createLibSqlOperationalStore,
      }),
      reconcileApprovalRun: createWorkflowApprovalRunReconciler(approvalWorkflow),
    });
    await dispatcher.reconcile();
    await purgeExpiredGeoIpCache(store, new Date());
    timer = setInterval(() => {
      if (iteration || Date.now() < backgroundRetryAfter) return;
      let stepId = 'outbox.reconcile';
      iteration = (async () => {
        await dispatcher.reconcile();
        stepId = 'outbox.dispatch';
        await dispatcher.runOnce();
        stepId = 'geoip.purge';
        await purgeExpiredGeoIpCache(store, new Date());
        stepId = 'approval.recovery';
        await recovery.runOnce();
        backgroundFailureCount = 0;
        backgroundRetryAfter = 0;
      })()
        .catch((error: unknown) => {
          backgroundFailureCount += 1;
          const delay = Math.min(
            config.outbox.backoffBaseMs * 2 ** Math.min(backgroundFailureCount - 1, 16),
            config.outbox.backoffCapMs,
          );
          backgroundRetryAfter = Date.now() + delay;
          logger.write({
            event: 'background.iteration.failed',
            stepId,
            errorCode: error instanceof DomainError ? error.code : 'BACKGROUND_ITERATION_FAILED',
            attempt: backgroundFailureCount,
          });
        })
        .finally(() => {
          iteration = undefined;
        });
    }, config.outbox.pollIntervalMs);
    timer.unref();
    const requestedPort = overrides.port ?? config.port;
    server = await (overrides.bindServer ?? bindHttpServer)(
      app.fetch,
      requestedPort,
      config.mode === 'local' ? '127.0.0.1' : '0.0.0.0',
    );
    const port = server.port;
    return Object.freeze({
      port,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        if (timer) clearInterval(timer);
        let shutdownError: unknown;
        const attempt = async (operation: () => void | Promise<void>) => {
          try {
            await operation();
          } catch (error) {
            shutdownError ??= error;
          }
        };
        if (server) await attempt(() => server!.close());
        if (retentionScheduler) await attempt(() => retentionScheduler!.stop());
        await attempt(() =>
          Promise.race([iteration ?? Promise.resolve(), new Promise<void>(resolve => setTimeout(resolve, 2_000))]).then(
            () => undefined,
          ),
        );
        await attempt(async () => unsubscribe?.());
        await attempt(() => domainEventPubSub.flush());
        if (ownsDomainEventPubSub) await attempt(() => closeDomainEventPubSub(domainEventPubSub));
        await attempt(() => store.close());
        await attempt(() => runtimeMastra.shutdown());
        if (shutdownError) throw shutdownError;
      },
    });
  } catch (error) {
    if (timer) clearInterval(timer);
    await retentionScheduler?.stop();
    await unsubscribe?.();
    await server?.close();
    store.close();
    if (ownsDomainEventPubSub) await closeDomainEventPubSub(domainEventPubSub);
    await runtimeMastra.shutdown();
    throw error;
  }
}

async function closeDomainEventPubSub(pubsub: PubSub): Promise<void> {
  const close = (pubsub as PubSub & { close?: () => Promise<void> }).close;
  if (close) await close.call(pubsub);
}

const bindHttpServer: BindServer = async (fetch, port, hostname) => {
  const server = serve({ fetch, port, hostname });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    port: typeof address === 'object' && address ? address.port : port,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
};
