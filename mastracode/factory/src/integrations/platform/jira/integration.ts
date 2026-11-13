import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import type { RouteAuth } from '../../../routes/route.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { IntegrationContext, IntegrationTools } from '../../base.js';
import type { IssueReconcileOne, IssueReconciler } from '../../issue-reconciler.js';
import type { JiraEventRules, JiraRuleOverrides } from '../../jira/default-rules.js';
import { resolveJiraRules } from '../../jira/default-rules.js';
import type { JiraIntakeScope } from '../../jira/intake-jql.js';
import { attachJiraIssueReconcileOne, attachJiraIssueReconciler } from '../../jira/issue-reconciler.js';
import { jiraReconciliationEnabled, jiraReconciliationInterval } from '../../jira/reconciliation-config.js';
import { attachJiraRules } from '../../jira/rules.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { PlatformConnectIntegration } from '../foundation/integration.js';
import { logPlatformInfo } from '../logging.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { buildPlatformJiraAgentTools } from './agent-tools.js';
import { handleJiraConnectEvent } from './connect-events.js';
import { PlatformJiraIntake, UUID_PATTERN } from './intake.js';
import type { JiraActiveIssuePage } from './intake.js';
import { buildPlatformJiraRoutes } from './routes.js';

export { decodeIssueReference, decodeSourceId, encodeIssueReference, encodeSourceId } from './intake.js';

const PLATFORM_JIRA_PROVIDER_CONFIG_KEY = 'jira';

export interface PlatformJiraIntegrationConfig {
  /** The Connect client, or options to build one; defaults to the platform environment. */
  connect?: PlatformConnectOption;
  /** Per-event replacements; omitted events retain defaults, null disables. */
  rules?: JiraRuleOverrides;
}

export class PlatformJiraIntegration extends PlatformConnectIntegration {
  readonly #endpointHost: string;
  readonly intake = new PlatformJiraIntake(this);
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();
  readonly #reconcileOne = new WeakMap<IntegrationContext, IssueReconcileOne | null>();

  readonly #rules: JiraEventRules;

  get rules(): JiraEventRules {
    return this.#rules;
  }

  constructor(config: PlatformJiraIntegrationConfig = {}) {
    const rules = resolveJiraRules(config.rules);
    const intervalMs = jiraReconciliationInterval();
    super({
      id: 'jira',
      providerKeys: [PLATFORM_JIRA_PROVIDER_CONFIG_KEY],
      ...(config.connect ? { connect: config.connect } : {}),
      linkOrgConnectionsAtBoot: true,
      connectProviders: [{ provider: 'jira', integrationId: PLATFORM_JIRA_PROVIDER_CONFIG_KEY }],
      ...(intervalMs ? { reconcileIntervalMs: intervalMs } : {}),
    });
    this.#rules = rules;
    this.#endpointHost = new URL(this.connect.baseUrl).host;
  }

  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
    logPlatformInfo('Platform Jira integration initialized', { endpointHost: this.#endpointHost });
  }

  get projects(): FactoryProjectsStorage {
    if (!this.#projects)
      throw new Error('PlatformJiraIntegration is not initialized — the factory binds storage during prepare().');
    return this.#projects;
  }

  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
  }

  async resolveOrgId(resourceId: string): Promise<string | null> {
    const cached = this.#orgIdByResourceId.get(resourceId);
    if (cached !== undefined) return cached;
    if (!UUID_PATTERN.test(resourceId)) {
      this.#orgIdByResourceId.set(resourceId, null);
      return null;
    }
    try {
      await this.projects.ensureReady();
      const project = await this.projects.getById({ id: resourceId });
      const orgId = project?.orgId ?? null;
      this.#orgIdByResourceId.set(resourceId, orgId);
      return orgId;
    } catch {
      return null;
    }
  }

  clearCaches(): void {
    this.#orgIdByResourceId.clear();
    this.intake.clearCaches();
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.listConnections()).some(connection => connection.status === 'active');
  }

  /**
   * One page of active issues across connections. Each scope's `projectId` is
   * an encoded Platform source id; sources are grouped per connection and each
   * group runs one JQL built from only that connection's projects.
   */
  listActiveIssues(cursor?: string, scopes: JiraIntakeScope[] = [], labels?: string[]): Promise<JiraActiveIssuePage> {
    return this.intake.listActiveIssues(cursor, scopes, labels);
  }

  protected override reconcile(ctx: IntegrationContext): IssueReconciler | null {
    if (!jiraReconciliationEnabled()) return null;
    return attachJiraIssueReconciler(this, ctx) ?? null;
  }

  protected override async handleConnectEvent(
    event: PlatformConnectEventDelivery,
    ctx: IntegrationContext,
  ): Promise<void> {
    // The reconcile kill switch covers events too: both run the card-closing path.
    if (!jiraReconciliationEnabled()) return;
    let reconcileOne = this.#reconcileOne.get(ctx);
    if (reconcileOne === undefined) {
      reconcileOne = attachJiraIssueReconcileOne(this, ctx) ?? null;
      this.#reconcileOne.set(ctx, reconcileOne);
    }
    await handleJiraConnectEvent(event, reconcileOne);
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    return buildPlatformJiraRoutes({
      jira: this,
      auth: ctx.auth,
      intake: ctx.storage.intake,
      workItems: ctx.runtime?.workItems,
      appDbConfigured: Boolean(ctx.factoryStorage),
      ingestFactoryIssues: attachJiraRules(this, ctx),
    });
  }

  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildPlatformJiraAgentTools({ requestContext: args.requestContext, jira: this });
  }

  override diagnostics(): Record<string, unknown> {
    return { ...super.diagnostics(), endpointHost: this.#endpointHost };
  }
}
