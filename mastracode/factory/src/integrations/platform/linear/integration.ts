import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import { loose } from '../../../routes/route.js';
import type { RouteAuth } from '../../../routes/route.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { IntegrationContext, IntegrationTools } from '../../base.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import type { IssueReconciler } from '../../issue-reconciler.js';
import { buildLinearAgentTools } from '../../linear/agent-tools.js';
import type { LinearEventRules, LinearRuleOverrides } from '../../linear/default-rules.js';
import { resolveLinearRules } from '../../linear/default-rules.js';
import type {
  LinearConnectionCheck,
  LinearIntegration,
  LinearIssueDetail as LinearRouteIssueDetail,
} from '../../linear/integration.js';
import { attachLinearIssueReconciler } from '../../linear/issue-reconciler.js';
import {
  linearIssueReconciliationEnabled,
  linearIssueReconciliationInterval,
} from '../../linear/reconciliation-config.js';
import { buildLinearRoutes } from '../../linear/routes.js';
import type { LinearConnectionWorkspace, LinearWorkspaceListingError } from '../../linear/routes.js';
import { attachLinearRules } from '../../linear/rules.js';
import type { LinearRulesIngress } from '../../linear/rules.js';
import type { LinearConnectionData, LinearConnectionRow, LinearStorageHandle } from '../../linear/storage.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { PlatformConnectIntegration } from '../foundation/integration.js';
import { logPlatformInfo } from '../logging.js';
import { platformErrorMessage, platformErrorStatus } from '../platform-connect.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { handleLinearConnectEvent } from './connect-events.js';
import { PLATFORM_MANAGED_CONNECTION_TOKEN, PlatformLinearIntake } from './intake.js';
import type { LinearWorkspace } from './intake.js';
import { PlatformLinearMigration } from './migration.js';
import { parseSourceId } from './source-id.js';

export { decodeTeamSourceId, encodeSourceId, encodeTeamSourceId, parseSourceId } from './source-id.js';
export type { DecodedSource } from './source-id.js';

/** Platform-managed connections always carry the comment scope. */
const PLATFORM_SCOPE = 'read,comments:create';

export interface PlatformLinearIntegrationConfig {
  rules?: LinearRuleOverrides;
  connect?: PlatformConnectOption;
}

/**
 * Linear through Mastra Connect. Every workspace is a project-linked Platform
 * `linear` connection, reached through the connection's GraphQL proxy.
 *
 * Workspaces the platform still holds legacy OAuth tokens for are migrated
 * into Connect automatically: at boot and on every reconcile interval, under
 * a lease so only one replica migrates. Migration links each new connection
 * to the Factory project, so the workspace's webhooks reach the project's
 * `connect` topic from then on. Until a workspace is migrated, Platform
 * Linear reports `migration_required` for it; there is no legacy fallback.
 */
export class PlatformLinearIntegration extends PlatformConnectIntegration {
  readonly intake = new PlatformLinearIntake(this, {
    unreachableWorkspaces: () =>
      this.#migration.settled ? null : 'the move of legacy Linear workspaces to Mastra Connect has not finished',
  });
  readonly #rules: LinearEventRules;
  readonly #endpointHost: string;
  readonly #migration: PlatformLinearMigration;
  readonly #ingest = new WeakMap<IntegrationContext, ((input: LinearRulesIngress) => Promise<unknown>) | null>();
  readonly #recentEventKeys = new Set<string>();
  #unverifiedEventsDropped = 0;
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;

  constructor(config: PlatformLinearIntegrationConfig = {}) {
    const intervalMs = linearIssueReconciliationInterval();
    super({
      id: 'linear',
      providerKeys: ['linear'],
      ...(config.connect ? { connect: config.connect } : {}),
      // Only the migrate call and project-scoped connect sessions link Linear connections.
      linkOrgConnectionsAtBoot: false,
      connectProviders: [{ provider: 'linear', integrationId: 'linear' }],
      ...(intervalMs ? { reconcileIntervalMs: intervalMs } : {}),
    });
    this.#rules = resolveLinearRules(config.rules);
    this.#endpointHost = new URL(this.connect.baseUrl).host;
    this.#migration = new PlatformLinearMigration({
      connect: () => this.connect,
      coveredWorkspaceIds: async () =>
        new Set((await this.intake.listWorkspaces()).map(workspace => workspace.linearWorkspaceId)),
      onMigrated: () => this.#connectionsChanged(),
    });
  }

  get rules(): LinearEventRules {
    return this.#rules;
  }

  get migration(): PlatformLinearMigration {
    return this.#migration;
  }

  get storage(): LinearStorageHandle {
    const now = new Date();
    return {
      integrationId: this.id,
      connections: {
        get: async (orgId: string) => ({
          id: `platform-linear:${orgId}`,
          orgId,
          userId: null,
          data: {
            accessToken: PLATFORM_MANAGED_CONNECTION_TOKEN,
            refreshToken: null,
            expiresAtMs: null,
            scope: PLATFORM_SCOPE,
            workspaceName: null,
            workspaceUrlKey: null,
          } satisfies LinearConnectionData,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        }),
      },
    } as unknown as LinearStorageHandle;
  }

  get projects(): FactoryProjectsStorage {
    if (!this.#projects) throw new Error('PlatformLinearIntegration projects storage has not been initialized.');
    return this.#projects;
  }

  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth?: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
    logPlatformInfo('Platform Linear integration initialized', { endpointHost: this.#endpointHost });
  }

  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
  }

  async resolveOrgId(resourceId: string): Promise<string | null> {
    try {
      const project = await this.projects.getById({ id: resourceId });
      return project?.orgId ?? null;
    } catch {
      return null;
    }
  }

  async loadConnection(orgId: string): Promise<LinearConnectionRow | null> {
    const workspace = (await this.intake.listWorkspaces())[0];
    if (!workspace) return null;
    const now = new Date();
    return {
      id: `platform-linear:${orgId}`,
      orgId,
      userId: null,
      accessToken: PLATFORM_MANAGED_CONNECTION_TOKEN,
      scope: PLATFORM_SCOPE,
      refreshToken: null,
      expiresAt: null,
      workspaceName: workspace.linearWorkspaceName,
      workspaceUrlKey: workspace.urlKey,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getFreshAccessToken(_connection: LinearConnectionRow): Promise<string> {
    return PLATFORM_MANAGED_CONNECTION_TOKEN;
  }

  canPostComments(connection: LinearConnectionRow): boolean {
    const scopes = (connection.scope ?? '').split(/[\s,]+/).filter(Boolean);
    return scopes.some(scope => scope === 'comments:create' || scope === 'write' || scope === 'admin');
  }

  async checkConnection(_orgId: string): Promise<LinearConnectionCheck> {
    // One snapshot for everything, so the count and the slug can't disagree.
    // A single link pattern is only accurate with one connected workspace;
    // with several, agents must link issues by their own `url`.
    const workspaces = await this.intake.listWorkspaces();
    const connected = workspaces.length > 0;
    return {
      connected,
      canComment: connected,
      workspaceUrlKey: workspaces.length === 1 ? (workspaces[0]?.urlKey ?? null) : null,
      checkedAt: Date.now(),
    };
  }

  async listWorkspaces(): Promise<LinearWorkspace[]> {
    return this.intake.listWorkspaces();
  }

  async listProjects(): ReturnType<PlatformLinearIntake['listProjects']> {
    return this.intake.listProjects();
  }

  async listTeams(_accessToken: string): ReturnType<PlatformLinearIntake['listTeams']> {
    return this.intake.listTeams();
  }

  async fetchIssueDetail(
    _accessToken: string,
    idOrIdentifier: string,
    sourceIds?: string[],
    routedSourceIds?: string[],
  ): Promise<LinearRouteIssueDetail | null> {
    const found = await this.intake.issueWithComments(idOrIdentifier, sourceIds, routedSourceIds);
    if (!found) return null;
    const { issue, comments, workspaceId } = found;
    return {
      id: issue.id,
      projectId: issue.project?.id ?? null,
      workspaceId,
      teamId: issue.team.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description?.trim() ? issue.description : null,
      url: issue.url,
      state: issue.state.name,
      stateType: issue.state.type,
      priorityLabel: issue.priorityLabel,
      assignee: issue.assignee?.displayName ?? issue.assignee?.name ?? null,
      creator: issue.creator?.displayName ?? issue.creator?.name ?? null,
      team: issue.team.key,
      labels: issue.labels.map(label => label.name),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      comments: comments.map(comment => ({
        author: comment.user?.displayName ?? comment.user?.name ?? null,
        body: comment.body,
        createdAt: comment.createdAt,
      })),
    };
  }

  sourceMatchesIssue(
    sourceId: string,
    issue: Pick<LinearRouteIssueDetail, 'workspaceId' | 'projectId' | 'teamId'>,
  ): boolean {
    const source = parseSourceId(sourceId);
    if (issue.workspaceId !== source.workspaceId) return false;
    return source.kind === 'team' ? issue.teamId === source.teamId : issue.projectId === source.projectId;
  }

  protected reconcile(ctx: IntegrationContext): IssueReconciler | null {
    if (!linearIssueReconciliationEnabled()) return null;
    return attachLinearIssueReconciler(this, ctx) ?? null;
  }

  /**
   * Linear webhooks of migrated workspaces, from the `connect` topic. The
   * route exists from boot, before any workspace is migrated, so a workspace
   * migrated later gets its events without a restart.
   */
  protected override async handleConnectEvent(
    event: PlatformConnectEventDelivery,
    ctx: IntegrationContext,
  ): Promise<void> {
    let ingest = this.#ingest.get(ctx);
    if (ingest === undefined) {
      ingest = attachLinearRules(this, ctx) ?? null;
      this.#ingest.set(ctx, ingest);
    }
    const workItems = ctx.runtime?.workItems;
    if (!ingest || !workItems) return;
    await handleLinearConnectEvent(event, {
      connectionWorkspace: connectionId => this.intake.connectionWorkspace(connectionId),
      projects: ctx.storage.projects,
      workItems,
      ingest,
      recentKeys: this.#recentEventKeys,
      onUnverifiedDropped: () => (this.#unverifiedEventsDropped += 1),
    });
  }

  /** The reconcile worker, plus the migration worker that moves legacy workspaces onto Connect. */
  workers(ctx: IntegrationContext): MastraWorker[] {
    const migrationWorker = new LinearMigrationWorker(this.#migration, this.reconcileIntervalMs);
    return [...super.workers(ctx), migrationWorker];
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    return [
      this.#migrateRoute(ctx),
      ...buildLinearRoutes({
        auth: ctx.auth,
        linear: this as unknown as LinearIntegration,
        listConnectionWorkspaces: () => this.#statusWorkspaces(),
        platformStatus: () => this.#platformStatus(),
        listProjectsWithStatus: async () => {
          const workspaceErrors: LinearWorkspaceListingError[] = [];
          return { projects: await this.intake.listProjects(workspaceErrors), workspaceErrors };
        },
        listTeamsWithStatus: async () => {
          const workspaceErrors: LinearWorkspaceListingError[] = [];
          return { teams: await this.intake.listTeams(workspaceErrors), workspaceErrors };
        },
        stateSigner: ctx.stateSigner,
        baseUrl: ctx.baseUrl,
        intake: ctx.storage.intake,
        projects: ctx.storage.projects,
        workItems: ctx.runtime?.workItems,
        boards: ctx.runtime?.boards,
        // Platform connects workspaces through the Connect routes, not Linear OAuth.
      }).filter(route => !route.path.startsWith('/auth/linear/')),
    ];
  }

  async agentTools({ requestContext }: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildLinearAgentTools({ requestContext, linear: this as unknown as LinearIntegration });
  }

  diagnostics(): Record<string, unknown> {
    const { required, pending, skipped, lastError } = this.#migration.state;
    return {
      ...super.diagnostics(),
      endpointHost: this.#endpointHost,
      migration: { required, pending, skipped, ...(lastError ? { lastError } : {}) },
      ...(this.#unverifiedEventsDropped > 0 ? { unverifiedEventsDropped: this.#unverifiedEventsDropped } : {}),
    };
  }

  /** Called when migration linked connections: the new ones must be seen at once, events included. */
  #connectionsChanged(): void {
    this.invalidateConnections();
    this.intake.clearCaches();
    this.requestReconcile();
  }

  /**
   * Connected workspaces, then the workspaces that need attention: connections
   * that must be connected afresh, and legacy workspaces waiting for migration.
   */
  async #statusWorkspaces(): Promise<LinearConnectionWorkspace[]> {
    const inventory = await this.intake.inventory();
    const connected = inventory.workspaces.map(workspace => ({
      id: workspace.linearWorkspaceId,
      name: workspace.linearWorkspaceName,
      urlKey: workspace.urlKey,
      connected: true,
    }));
    const seen = new Set(connected.map(workspace => workspace.id));
    const unusable = inventory.unusable.flatMap(connection => {
      const id = connection.linearWorkspaceId ?? connection.connectionId;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, name: connection.accountLabel ?? id, urlKey: null, connected: false }];
    });
    return [...connected, ...unusable];
  }

  async #platformStatus(): Promise<{ notConnectedReason?: string; fields: Record<string, unknown> }> {
    const [inventory, migration] = await Promise.all([
      this.intake.inventory(),
      this.#migration.refreshStatus().catch(() => this.#migration.state),
    ]);
    const { required, pending, skipped, lastError } = migration;
    return {
      ...(required ? { notConnectedReason: 'migration_required' } : {}),
      fields: {
        migration: { required, pending, skipped, ...(lastError ? { lastError } : {}) },
        ...(inventory.unusable.length > 0 ? { requiresFreshConnect: inventory.unusable } : {}),
        ...(inventory.duplicates.length > 0 ? { duplicates: inventory.duplicates } : {}),
      },
    };
  }

  /** Manual retry of the automatic migration, for org admins. */
  #migrateRoute(ctx: IntegrationContext): ApiRoute {
    return registerApiRoute('/web/integrations/platform/linear/migrate', {
      method: 'POST',
      requiresAuth: false,
      handler: async rawContext => {
        const c = loose(rawContext);
        if (!ctx.auth.enabled()) return c.json({ error: 'auth_disabled' }, 403);
        await ctx.auth.ensureUser(c);
        const tenant = ctx.auth.tenant(c);
        if (!tenant) return c.json({ error: 'unauthorized' }, 401);
        if (!tenant.orgId || !(await ctx.auth.isOrganizationAdmin(c, tenant.orgId))) {
          return c.json(
            {
              error: 'organization_admin_required',
              message: 'Organization administrator access is required to migrate Linear workspaces.',
            },
            403,
          );
        }
        try {
          const result = await this.#migration.run('admin');
          return c.json({ ...result, migration: this.#migration.state });
        } catch (error) {
          const status = platformErrorStatus(error);
          return c.json(
            {
              error: 'linear_migration_failed',
              message: platformErrorMessage(error),
              migration: this.#migration.state,
            },
            status === 403 ? 403 : 502,
          );
        }
      },
    });
  }
}

/** Runs the migration under a lease on one replica; stopping it also cancels a pending retry. */
class LinearMigrationWorker extends IssueReconcileWorker {
  readonly #migration: PlatformLinearMigration;

  constructor(migration: PlatformLinearMigration, intervalMs: number) {
    let worker: LinearMigrationWorker | undefined;
    super({
      integrationId: 'linear-connect-migration',
      reconcile: migration.sweep(() => worker?.requestRun()),
      intervalMs,
    });
    worker = this;
    this.#migration = migration;
  }

  async stop(): Promise<void> {
    this.#migration.stop();
    await super.stop();
  }
}
