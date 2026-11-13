import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { Intake, IntakeSource } from '../../../capabilities/intake.js';
import { loose } from '../../../routes/route.js';
import type { FactoryIntegration, IntegrationContext } from '../../base.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import { attachVantaRules } from '../../vanta/rules.js';
import { createVantaSync, DEFAULT_VANTA_SYNC_INTERVAL_MS, VANTA_VULNERABILITIES_SOURCE_ID } from '../../vanta/sync.js';
import type { VantaVulnerability } from '../../vanta/sync.js';
import { PlatformApiClient, platformApiClientConfigFromEnv } from '../api-client.js';
import type { PlatformApiClientConfig } from '../api-client.js';

export interface PlatformVantaIntegrationConfig {
  clientConfig?: PlatformApiClientConfig;
  syncIntervalMs?: number;
}

/** Provider key registered for Vanta in Mastra Platform's integrations catalog. */
const PLATFORM_VANTA_PROVIDER_KEY = 'vanta';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface PlatformIntegrationConnection {
  id: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
  resourceId: string | null;
}

interface VantaVulnerabilityPage {
  results: {
    data: VantaVulnerability[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

/**
 * Files Vanta vulnerabilities as `security`-labeled cards through Platform-managed (MastraConnect)
 * Vanta connections. Vanta has no webhooks Factory can consume, so a worker polls the active list.
 */
export class PlatformVantaIntegration implements FactoryIntegration {
  readonly id = 'vanta';
  readonly #client: PlatformApiClient;
  readonly #syncIntervalMs: number;

  readonly intake: Intake = {
    listSources: () => this.#listSources(),
    listItems: async () => ({ items: [], nextCursor: null }),
    listIssues: async () => ({ issues: [], nextCursor: null }),
    getIssue: async () => null,
    createComment: async () => null,
    updateIssue: async () => null,
  };

  constructor(config: PlatformVantaIntegrationConfig = {}) {
    this.#client = new PlatformApiClient(config.clientConfig ?? platformApiClientConfigFromEnv());
    this.#syncIntervalMs = config.syncIntervalMs ?? DEFAULT_VANTA_SYNC_INTERVAL_MS;
  }

  async listConnections(): Promise<PlatformIntegrationConnection[]> {
    const result = await this.#client.request<{ connections: PlatformIntegrationConnection[] }>(
      'GET',
      `/v2/connections?providerKey=${PLATFORM_VANTA_PROVIDER_KEY}`,
    );
    return result.connections;
  }

  async #activeConnections(): Promise<PlatformIntegrationConnection[]> {
    const connections = await this.listConnections();
    return connections.filter(connection => connection.status === 'active').sort((a, b) => a.id.localeCompare(b.id));
  }

  async #listSources(): Promise<IntakeSource[]> {
    if ((await this.#activeConnections()).length === 0) return [];
    return [{ id: VANTA_VULNERABILITIES_SOURCE_ID, name: 'Vulnerabilities', type: 'vulnerabilities' }];
  }

  /** Every active vulnerability from the supplied connections, de-duplicated by id. */
  async listVulnerabilities(connections?: PlatformIntegrationConnection[]): Promise<VantaVulnerability[]> {
    const selected = connections ?? (await this.listConnections()).sort((a, b) => a.id.localeCompare(b.id));
    if (selected.length === 0) throw new Error('There is no active Vanta connection.');
    const unreadable = selected.find(connection => connection.status !== 'active');
    if (unreadable) throw new Error(`Vanta connection ${unreadable.id} is ${unreadable.status}.`);
    const byId = new Map<string, VantaVulnerability>();
    for (const connection of selected) {
      let cursor: string | null = null;
      for (let page = 0; ; page++) {
        if (page === MAX_PAGES) {
          // A cut-off list would read as the rest being resolved.
          throw new Error(`Vanta connection ${connection.id} has more than ${MAX_PAGES} pages of vulnerabilities.`);
        }
        const query = new URLSearchParams({ isDeactivated: 'false', pageSize: String(PAGE_SIZE) });
        if (cursor) query.set('pageCursor', cursor);
        const result: VantaVulnerabilityPage = await this.#client.request<VantaVulnerabilityPage>(
          'GET',
          `/v2/connections/${encodeURIComponent(connection.id)}/proxy/v1/vulnerabilities?${query}`,
        );
        for (const vulnerability of result.results.data) byId.set(vulnerability.id, vulnerability);
        if (!result.results.pageInfo.hasNextPage) break;
        if (!result.results.pageInfo.endCursor || page === MAX_PAGES - 1) {
          throw new Error(`Incomplete Vanta vulnerability snapshot for connection ${connection.id}`);
        }
        cursor = result.results.pageInfo.endCursor;
      }
    }
    return [...byId.values()];
  }

  async listVulnerabilitiesForOrg(orgId: string, factoryProjects: ReadonlyArray<{ id: string; orgId: string }>): Promise<VantaVulnerability[] | null> {
    const connections = await this.listConnections();
    const ownerByProject = new Map(factoryProjects.map(project => [project.id, project.orgId]));
    // A global or unrecognized connection cannot be attributed safely across organizations.
    if (connections.some(connection => connection.resourceId && !ownerByProject.has(connection.resourceId))) return null;
    if (new Set(factoryProjects.map(project => project.orgId)).size > 1 &&
        connections.some(connection => !connection.resourceId)) return null;
    const owned = connections.filter(connection =>
      connection.resourceId ? ownerByProject.get(connection.resourceId) === orgId : true,
    );
    if (owned.length === 0 || owned.some(connection => connection.status === 'needs_reauth')) return null;
    return this.listVulnerabilities(owned.filter(connection => connection.status === 'active'));
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    const ingest = attachVantaRules(ctx);
    if (!ingest) return [];
    const { projects, intake } = ctx.storage;
    const sync = createVantaSync({
      connected: async () => (await this.#activeConnections()).length > 0,
      listVulnerabilities: async orgId => this.listVulnerabilitiesForOrg(orgId, await projects.listAll()),
      listProjects: () => projects.listAll(),
      intakeEnabled: async orgId =>
        (await intake.getConfig({ orgId, integrationIds: [this.id] }))[this.id]?.enabled ?? false,
      boundProjectIds: async orgId =>
        (await intake.listBindings({ orgId, integrationId: this.id })).map(binding => binding.factoryProjectId),
      ingest,
      userId: 'factory-rule-dispatcher',
    });
    return [new IssueReconcileWorker({ integrationId: this.id, reconcile: sync, intervalMs: this.#syncIntervalMs })];
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    return [
      registerApiRoute('/web/vanta/status', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          if (!ctx.auth.enabled()) return c.json({ enabled: false, configured: true, reason: 'missing_config' });
          await ctx.auth.ensureUser(loose(c));
          const tenant = ctx.auth.tenant(loose(c));
          if (!tenant) return c.json({ error: 'unauthorized', reason: 'auth_required' }, 401);
          if (!tenant.orgId) return c.json({ enabled: true, configured: true, reason: 'organization_required' });
          return c.json({ enabled: true, configured: true, reason: 'ready' });
        },
      }),
    ];
  }

  diagnostics(): Record<string, unknown> {
    return { configured: true, mode: 'platform' };
  }
}
