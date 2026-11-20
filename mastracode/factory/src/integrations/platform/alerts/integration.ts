import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { Intake, IntakeSource } from '../../../capabilities/intake.js';
import { factoryWorkItemUrl } from '../../../links.js';
import { loose } from '../../../routes/route.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { AlertReadClient, buildAlertReadTools } from '../../alerts/read-tools.js';
import type { AlertReadToken } from '../../alerts/read-tools.js';
import { ALERT_INTEGRATION_ID, attachPlatformAlertRules } from '../../alerts/rules.js';
import { createAlertSync } from '../../alerts/sync.js';
import type { AlertAck, AlertEventPage, AlertSyncCursor } from '../../alerts/sync.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../../base.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import { createPlatformConnectClient, platformErrorStatus } from '../platform-connect.js';
import type { PlatformConnectOption } from '../platform-connect.js';

const API_PREFIX = '/v1/server/alerts';
const DEFAULT_ALERT_POLL_INTERVAL_MS = 20_000;
const CURSOR_ORG_ID = '__platform_alerts_event_worker__';
const CURSOR_USER_ID = 'worker';
export const MASTRA_ALERTS_SOURCE_ID = 'alerts';

export interface PlatformAlertsConnection {
  organizationId: string;
  factoryProjectId: string;
  connectedAt: string;
}

export interface PlatformAlertsIntegrationConfig {
  /** Connect client, or its options; defaults to {@link alertsClientConfigFromEnv}. */
  connect?: PlatformConnectOption;
  pollIntervalMs?: number;
}

const DEFAULT_PLATFORM_API_URL = 'https://platform.mastra.ai';

/**
 * The alert routes live on the Platform api, not the integrations service: `MASTRA_ALERTS_API_URL`
 * overrides, else the api Platform injects into every deployment (`MASTRA_SHARED_API_URL`), else
 * production. The credential, org and project are the deployment's, as for every Connect call.
 */
export function alertsClientConfigFromEnv(): { baseUrl: string } {
  const baseUrl =
    process.env.MASTRA_ALERTS_API_URL?.trim() || process.env.MASTRA_SHARED_API_URL?.trim() || DEFAULT_PLATFORM_API_URL;
  return { baseUrl: baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '') };
}

/**
 * Mastra Alerts as an intake source. The org connects once; Platform appends every alert incident
 * event for that org to its alert event log, and a worker here tails it and files one card per
 * alert rule in each bound project. Agent tools read the incident's observability data with a
 * short-lived, region-bound token Platform mints per incident.
 */
export class PlatformAlertsIntegration implements FactoryIntegration {
  readonly id = ALERT_INTEGRATION_ID;
  readonly #client: ReturnType<typeof createPlatformConnectClient>;
  readonly #pollIntervalMs: number;
  readonly #reader: AlertReadClient;
  #projects: Pick<FactoryProjectsStorage, 'listAll'> | undefined;

  readonly intake: Intake = {
    listSources: () => this.#listSources(),
    listItems: async () => ({ items: [], nextCursor: null }),
    listIssues: async () => ({ issues: [], nextCursor: null }),
    getIssue: async () => null,
    createComment: async () => null,
    updateIssue: async () => null,
  };

  constructor(config: PlatformAlertsIntegrationConfig = {}) {
    this.#client = createPlatformConnectClient(config.connect ?? alertsClientConfigFromEnv());
    this.#pollIntervalMs = config.pollIntervalMs ?? DEFAULT_ALERT_POLL_INTERVAL_MS;
    this.#reader = new AlertReadClient({
      mint: incidentId =>
        this.#client.request<AlertReadToken>(
          'POST',
          `${API_PREFIX}/incidents/${encodeURIComponent(incidentId)}/observability-token`,
        ),
    });
  }

  /** The Platform org this Factory's credential has connected, or null. */
  async connection(): Promise<PlatformAlertsConnection | null> {
    try {
      return await this.#client.request<PlatformAlertsConnection>('GET', `${API_PREFIX}/connection`);
    } catch (error) {
      if (platformErrorStatus(error) === 404) return null;
      throw error;
    }
  }

  async connect(): Promise<PlatformAlertsConnection> {
    // A project token names the Factory's project itself; an org secret key needs it in the body.
    const factoryProjectId = process.env.MASTRA_PROJECT_ID?.trim();
    return this.#client.request<PlatformAlertsConnection>('PUT', `${API_PREFIX}/connection`, {
      body: factoryProjectId ? { factoryProjectId } : {},
    });
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.connection()) !== null;
  }

  async #listSources(): Promise<IntakeSource[]> {
    if (!(await this.hasActiveConnections())) return [];
    return [{ id: MASTRA_ALERTS_SOURCE_ID, name: 'Alerts', type: 'alerts' }];
  }

  async agentTools({ requestContext }: { requestContext: RequestContext }): Promise<IntegrationTools> {
    const controller = requestContext.get('controller') as
      { getState(): { factoryProjectId?: string }; resourceId?: string } | undefined;
    const projectId = controller?.getState().factoryProjectId ?? controller?.resourceId;
    if (!projectId || !this.#projects) return {};
    const project = (await this.#projects.listAll()).find(p => p.id === projectId);
    const connection = project ? await this.connection() : null;
    // The credential reads one Platform org; only that org's sessions get the tools.
    if (!project || !connection || connection.organizationId !== project.orgId) return {};
    return buildAlertReadTools(this.#reader, connection.organizationId);
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    this.#projects = ctx.storage.projects;
    const ingest = attachPlatformAlertRules(ctx);
    if (!ingest) return [];
    const { projects, intake, generic } = ctx.storage;
    const sync = createAlertSync({
      organizationId: async () => (await this.connection())?.organizationId ?? null,
      listEvents: afterEventId => {
        const query = new URLSearchParams({ limit: '100' });
        if (afterEventId) query.set('afterEventId', afterEventId);
        return this.#client.request<AlertEventPage>('GET', `${API_PREFIX}/events?${query}`);
      },
      ack: async (ack: AlertAck) => {
        await this.#client.request('POST', `${API_PREFIX}/acks`, { body: ack });
      },
      loadCursor: async () =>
        ((await generic.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID)) as AlertSyncCursor | null) ?? {},
      saveCursor: cursor => generic.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, cursor as Record<string, unknown>),
      listProjects: () => projects.listAll(),
      intakeEnabled: async orgId =>
        (await intake.getConfig({ orgId, integrationIds: [this.id] }))[this.id]?.enabled ?? false,
      bindings: orgId => intake.listBindings({ orgId, integrationId: this.id }),
      ingest,
      workItemUrl: ({ factoryProjectId, workItemId }) => factoryWorkItemUrl({ factoryProjectId, workItemId }),
    });
    return [new IssueReconcileWorker({ integrationId: this.id, reconcile: sync, intervalMs: this.#pollIntervalMs })];
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    this.#projects = ctx.storage.projects;
    const tenantOrConnection = async (c: Parameters<typeof loose>[0]) => {
      if (!ctx.auth.enabled()) return { error: { enabled: false, configured: true, reason: 'missing_config' } };
      await ctx.auth.ensureUser(loose(c));
      const tenant = ctx.auth.tenant(loose(c));
      if (!tenant) return { error: { error: 'unauthorized', reason: 'auth_required' }, status: 401 as const };
      if (!tenant.orgId) return { error: { enabled: true, configured: true, reason: 'organization_required' } };
      return { orgId: tenant.orgId };
    };
    return [
      registerApiRoute('/web/mastra-alerts/status', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const who = await tenantOrConnection(c);
          if ('error' in who) return c.json(who.error, who.status ?? 200);
          const connection = await this.connection();
          const connected = connection?.organizationId === who.orgId;
          return c.json({ enabled: true, configured: true, reason: 'ready', connected });
        },
      }),
      registerApiRoute('/web/mastra-alerts/connect', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => {
          const who = await tenantOrConnection(c);
          if ('error' in who) return c.json(who.error, who.status ?? 400);
          const connection = await this.connect();
          if (connection.organizationId !== who.orgId) {
            return c.json({ error: 'This Factory reports alerts for another organization' }, 403);
          }
          return c.json({ connected: true, connection });
        },
      }),
    ];
  }

  diagnostics(): Record<string, unknown> {
    return { configured: true, mode: 'platform' };
  }
}
