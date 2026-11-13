import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import type { RouteAuth } from '../../../routes/route.js';
import type { IntakeStorage } from '../../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { IntegrationContext, IntegrationTools } from '../../base.js';
import { buildIncidentioAgentTools } from '../../incidentio/agent-tools.js';
import { resolveIncidentioRules } from '../../incidentio/default-rules.js';
import type { IncidentioEventRules, IncidentioRuleOverrides } from '../../incidentio/default-rules.js';
import {
  attachIncidentioIssueReconcileOne,
  attachIncidentioIssueReconciler,
} from '../../incidentio/issue-reconciler.js';
import {
  incidentioReconciliationEnabled,
  incidentioReconciliationInterval,
} from '../../incidentio/reconciliation-config.js';
import { buildIncidentioRoutes } from '../../incidentio/routes.js';
import { attachIncidentioRules } from '../../incidentio/rules.js';
import type { IssueReconcileOne, IssueReconciler } from '../../issue-reconciler.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { PlatformConnectIntegration } from '../foundation/integration.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { handleIncidentioConnectEvent } from './connect-events.js';
import { PlatformIncidentioIntake, UUID_RE } from './intake.js';

export { decodeScopedSourceId, encodeScopedSourceId } from './intake.js';

export interface PlatformIncidentioIntegrationConfig {
  /** The Connect client, or options to build one; defaults to the platform environment. */
  connect?: PlatformConnectOption;
  /** Per-event replacements for the default Factory incident.io rules. */
  rules?: IncidentioRuleOverrides;
}

/**
 * Provider config key registered for incident.io in Mastra Platform's
 * integrations catalog. Connections are discovered at runtime — no
 * deploy-time connection ID wiring.
 */
const PLATFORM_INCIDENTIO_PROVIDER_CONFIG_KEY = 'incident-io';

export class PlatformIncidentioIntegration extends PlatformConnectIntegration {
  readonly #endpointHost: string;
  readonly intake = new PlatformIncidentioIntake(this);
  readonly #rules: IncidentioEventRules;

  /** Bound once by the factory via `initialize()` before any surface is used. */
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  #intakeStorage: IntakeStorage | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();
  readonly #reconcileOne = new WeakMap<IntegrationContext, IssueReconcileOne | null>();

  constructor(config: PlatformIncidentioIntegrationConfig = {}) {
    const rules = resolveIncidentioRules(config.rules);
    const intervalMs = incidentioReconciliationInterval();
    super({
      id: 'incidentio',
      providerKeys: [PLATFORM_INCIDENTIO_PROVIDER_CONFIG_KEY],
      ...(config.connect ? { connect: config.connect } : {}),
      linkOrgConnectionsAtBoot: true,
      connectProviders: [{ provider: 'incident-io', integrationId: PLATFORM_INCIDENTIO_PROVIDER_CONFIG_KEY }],
      ...(intervalMs ? { reconcileIntervalMs: intervalMs } : {}),
    });
    this.#rules = rules;
    this.#endpointHost = new URL(this.connect.baseUrl).host;
  }

  /** Event rules driving automatic follow-up materialization and close handling. */
  get rules(): IncidentioEventRules {
    return this.#rules;
  }

  initialize({
    projects,
    auth,
    intake,
  }: {
    projects: FactoryProjectsStorage;
    auth: RouteAuth;
    intake: IntakeStorage;
  }): void {
    this.#projects = projects;
    this.#auth = auth;
    this.#intakeStorage = intake;
  }

  /** Cross-integration intake selection/binding domain — agent-tool authorization. */
  get intakeStorage(): IntakeStorage {
    if (!this.#intakeStorage) {
      throw new Error('PlatformIncidentioIntegration is not initialized — the factory binds storage during prepare().');
    }
    return this.#intakeStorage;
  }

  /** Factory projects domain — maps a session's resourceId to its owning org. */
  get projects(): FactoryProjectsStorage {
    if (!this.#projects) {
      throw new Error('PlatformIncidentioIntegration is not initialized — the factory binds storage during prepare().');
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
    if (!UUID_RE.test(resourceId)) {
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

  /**
   * Org-scoped agent tools: the read-only follow-up detail tool for sessions
   * whose resource is a factory project with an active Platform-managed
   * incident.io connection.
   */
  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    if (!(await this.hasActiveConnections())) return {};
    return buildIncidentioAgentTools({ requestContext: args.requestContext, incidentio: this });
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.activeConnections()).length > 0;
  }

  clearCaches(): void {
    this.intake.clearCaches();
    this.#orgIdByResourceId.clear();
  }

  protected override reconcile(ctx: IntegrationContext): IssueReconciler | null {
    if (!incidentioReconciliationEnabled()) return null;
    return attachIncidentioIssueReconciler(this, ctx) ?? null;
  }

  protected override async handleConnectEvent(
    event: PlatformConnectEventDelivery,
    ctx: IntegrationContext,
  ): Promise<void> {
    let reconcileOne = this.#reconcileOne.get(ctx);
    if (reconcileOne === undefined) {
      reconcileOne = attachIncidentioIssueReconcileOne(this, ctx) ?? null;
      this.#reconcileOne.set(ctx, reconcileOne);
    }
    await handleIncidentioConnectEvent(event, reconcileOne);
  }

  /**
   * The integration's HTTP surface: `/web/incidentio/*` Mastra `apiRoutes`
   * (status + follow-up listing/detail for Intake), aggregated across every
   * discovered Platform connection. A board-scoped listing also feeds the
   * incident.io event rules.
   */
  routes(ctx: IntegrationContext): ApiRoute[] {
    return buildIncidentioRoutes({
      incidentio: this,
      mode: 'platform',
      auth: ctx.auth,
      intake: ctx.storage.intake,
      ingestFactoryIssues: attachIncidentioRules(this, ctx),
    });
  }

  override diagnostics(): Record<string, unknown> {
    return { ...super.diagnostics(), endpointHost: this.#endpointHost };
  }
}
