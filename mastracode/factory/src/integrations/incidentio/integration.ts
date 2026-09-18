import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { RouteAuth } from '../../routes/route.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../base.js';
import { IssueReconcileWorker } from '../issue-reconcile-worker.js';
import { buildIncidentioAgentTools } from './agent-tools.js';
import { IncidentioApiClient } from './api.js';
import { resolveIncidentioRules } from './default-rules.js';
import type { IncidentioEventRules, IncidentioRuleOverrides } from './default-rules.js';
import { createIncidentioIntake } from './intake.js';
import { attachIncidentioIssueReconciler } from './issue-reconciler.js';
import { incidentioReconciliationEnabled, incidentioReconciliationInterval } from './reconciliation-config.js';
import { buildIncidentioRoutes } from './routes.js';
import { attachIncidentioRules } from './rules.js';

export interface IncidentioIntegrationConfig {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  /** Per-event replacements for the default Factory incident.io rules. */
  rules?: IncidentioRuleOverrides;
}

const DIRECT_CONNECTION_TOKEN = 'incidentio-direct-api-key';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class IncidentioIntegration implements FactoryIntegration {
  readonly id = 'incidentio';
  readonly intake;
  readonly #endpointHost: string;
  readonly #rules: IncidentioEventRules;

  /** Bound once by the factory via `initialize()` before any surface is used. */
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();

  constructor(config: IncidentioIntegrationConfig = {}) {
    this.#rules = resolveIncidentioRules(config.rules);
    const apiKey = config.apiKey?.trim() || process.env.INCIDENT_IO_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('IncidentioIntegration: missing required INCIDENT_IO_API_KEY.');
    }
    const baseUrl = config.baseUrl ?? 'https://api.incident.io';
    this.#endpointHost = new URL(baseUrl).host;
    const api = new IncidentioApiClient({
      baseUrl,
      accessToken: apiKey,
      ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    });
    this.intake = createIncidentioIntake({
      api,
      connection: { type: 'oauth', accessToken: DIRECT_CONNECTION_TOKEN },
    });
  }

  /** Event rules driving automatic follow-up materialization and close handling. */
  get rules(): IncidentioEventRules {
    return this.#rules;
  }

  /**
   * Bind the projects domain and the host auth seam. incident.io has no
   * per-org connection rows here — credentials are deployment-global
   * constructor config.
   */
  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
  }

  /** Factory projects domain — maps a session's resourceId to its owning org. */
  get projects(): FactoryProjectsStorage {
    if (!this.#projects) {
      throw new Error('IncidentioIntegration is not initialized — the factory binds storage during prepare().');
    }
    return this.#projects;
  }

  /** Whether the host runs with web auth enabled; every surface is inert without it. */
  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
  }

  /**
   * Map a session's resourceId (the factory project id) to its owning org.
   * Same caching semantics as the Jira integration: definitive misses are
   * cached, transient database failures are not.
   */
  async resolveOrgId(resourceId: string): Promise<string | null> {
    const cached = this.#orgIdByResourceId.get(resourceId);
    if (cached !== undefined) return cached;
    if (!UUID_PATTERN.test(resourceId)) {
      this.#orgIdByResourceId.set(resourceId, null);
      return null;
    }
    let orgId: string | null;
    try {
      await this.projects.ensureReady();
      const project = await this.projects.getById({ id: resourceId });
      orgId = project?.orgId ?? null;
    } catch {
      // Transient database failure: skip the tools for this request but don't
      // cache the miss, so the next request retries the lookup.
      return null;
    }
    this.#orgIdByResourceId.set(resourceId, orgId);
    return orgId;
  }

  /** Test hook: clear the org cache between specs. */
  clearCaches(): void {
    this.#orgIdByResourceId.clear();
  }

  /**
   * Org-scoped agent tools: the read-only follow-up detail tool for sessions
   * whose resource is a factory project, matching the Linear/Jira surface.
   */
  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildIncidentioAgentTools({ requestContext: args.requestContext, incidentio: this });
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    if (!incidentioReconciliationEnabled()) return [];
    const reconcile = attachIncidentioIssueReconciler(this, ctx);
    if (!reconcile) return [];
    const intervalMs = incidentioReconciliationInterval();
    return [
      new IssueReconcileWorker({
        integrationId: this.id,
        reconcile,
        ...(intervalMs ? { intervalMs } : {}),
      }),
    ];
  }

  /**
   * The integration's HTTP surface: `/web/incidentio/*` Mastra `apiRoutes`
   * (status + follow-up listing/detail for Intake). Handlers operate on this
   * instance; a board-scoped listing also feeds the incident.io event rules.
   */
  routes(ctx: IntegrationContext): ApiRoute[] {
    return buildIncidentioRoutes({
      incidentio: this,
      auth: ctx.auth,
      intake: ctx.storage.intake,
      ingestFactoryIssues: attachIncidentioRules(this, ctx),
    });
  }

  diagnostics(): Record<string, unknown> {
    return { mode: 'api-key', endpointHost: this.#endpointHost };
  }
}
