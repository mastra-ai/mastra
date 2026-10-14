import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type { Intake, IntakeIssue, IntakeIssueDetail, UpdateIntakeIssueInput } from '../../../capabilities/intake.js';
import type { RouteAuth } from '../../../routes/route.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../../base.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
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
import { attachLinearRules } from '../../linear/rules.js';
import type { LinearConnectionData, LinearConnectionRow, LinearStorageHandle } from '../../linear/storage.js';
import {
  logPlatformInfo,
  logPlatformWarn,
  PlatformApiClient,
  PlatformApiError,
  platformApiClientConfigFromEnv,
} from '../api-client.js';
import { buildPlatformLinearAgentTools } from './agent-tools.js';
import { LinearProxyApi } from './proxy-api.js';
import type {
  IssueWithComments,
  LinearComment,
  LinearIssue,
  LinearProject,
  LinearTeam,
  LinearWorkflowState,
  LinearCreatedIssue,
  LinearOrganization,
  PageInfo,
} from './proxy-api.js';

type LinearWorkspace = {
  linearWorkspaceId: string;
  linearWorkspaceName: string;
  urlKey: string | null;
  connected: boolean;
  connectionId: string;
  accountLabel: string | null;
};
type ProjectSource = { workspace: LinearWorkspace; project: LinearProject };
type TeamSource = { workspace: LinearWorkspace; team: LinearTeam };

export interface PlatformLinearConnection {
  id: string;
  providerKey?: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

const PROVIDER_KEY = 'linear';
const CONNECTION_TOKEN_PREFIX = 'linear-connection:';
const PAGE_SIZE = 30;
const MAX_REFERENCE_PAGES = 20;
const MAX_COMMENT_PAGES = 20;

export function linearConnectionToken(connectionId: string): string {
  return `${CONNECTION_TOKEN_PREFIX}${connectionId}`;
}

export class PlatformLinearIntegration implements FactoryIntegration {
  readonly id = 'linear';
  readonly #client: PlatformApiClient;
  readonly #endpointHost: string;
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  /**
   * Per-instance workflow-state cache keyed by `${workspaceId}:${teamId}`. Scoped to the process
   * lifetime; not shared across requests intentionally to keep failure modes simple (stale states
   * clear on process restart). Populated lazily on first `updateIssue` per team.
   */
  readonly #workflowStatesByTeam = new Map<string, LinearWorkflowState[]>();
  /** Linear organization behind each Connect connection; stable for a connection's lifetime. */
  readonly #organizationByConnectionId = new Map<string, LinearOrganization>();

  readonly intake: Intake = {
    resolveIntakeDispatch: input => this.#resolveIntakeDispatch(input),
    listSources: async () => {
      const [projectSources, teamSources] = await Promise.all([this.#listProjectSources(), this.#listTeamSources()]);
      const projects = projectSources.map(({ workspace, project }) => ({
        id: encodeSourceId(workspace, project.id),
        name: project.name,
        type: 'project' as const,
        metadata: {
          connectionId: workspace.connectionId,
          connectionLabel: workspace.accountLabel,
          workspaceId: workspace.linearWorkspaceId,
          workspaceName: workspace.linearWorkspaceName,
          workspaceUrlKey: workspace.urlKey,
          state: project.state,
          teams: project.teams,
        },
      }));
      const teams = teamSources.map(({ workspace, team }) => ({
        id: encodeTeamSourceId(workspace, team.id),
        name: team.name,
        type: 'team' as const,
        metadata: {
          connectionId: workspace.connectionId,
          connectionLabel: workspace.accountLabel,
          workspaceId: workspace.linearWorkspaceId,
          workspaceName: workspace.linearWorkspaceName,
          workspaceUrlKey: workspace.urlKey,
          teamKey: team.key,
        },
      }));
      return [...projects, ...teams];
    },
    listItems: async ({ sourceIds, attributionSourceIds, cursor }) => {
      const result = await this.#listIssues(sourceIds, cursor, undefined, attributionSourceIds);
      return {
        items: result.issues.map(({ issue, sourceId, workspace }) => ({
          source: { type: 'issue', externalId: issue.id, url: issue.url },
          sourceId,
          title: issue.title,
          status: issue.state.name,
          labels: issue.labels.map(label => label.name),
          assignee: issue.assignee?.displayName ?? issue.assignee?.name ?? null,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          metadata: {
            identifier: issue.identifier,
            workspaceId: workspace.linearWorkspaceId,
            workspaceName: workspace.linearWorkspaceName,
            projectId: issue.project?.id ?? null,
            team: issue.team.key,
            priority: issue.priorityLabel,
          },
        })),
        nextCursor: result.nextCursor,
      };
    },
    listIssues: async ({ connection, sourceIds, attributionSourceIds, labels, cursor }) => {
      requireLinearConnection(connection);
      const result = await this.#listIssues(sourceIds, cursor, labels, attributionSourceIds);
      return {
        issues: result.issues.map(({ issue, sourceId, workspace }) => ({
          ...parseIssue(issue, workspace),
          sourceId,
        })),
        nextCursor: result.nextCursor,
      };
    },
    getIssue: async ({ connection, sourceId, issueId }) => {
      requireLinearConnection(connection);
      const located = await this.#findIssue(sourceId, issueId);
      if (!located) return null;
      const comments = await this.#loadComments(located.workspace, issueId, located.issue.comments);
      return parseIssueDetail(located.issue, comments, located.workspace);
    },
    createComment: async ({ connection, sourceId, issueId, body }) => {
      requireLinearConnection(connection);
      const workspace = await this.#resolveWorkspaceForIssue(sourceId, issueId);
      if (!workspace) return null;
      try {
        const comment = await this.#apiFor(workspace).createComment(issueId, body);
        return { id: comment.id, url: comment.url };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    updateIssue: async (input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> => {
      requireLinearConnection(input.connection);
      const located = await this.#findIssue(input.sourceId, input.issueId);
      if (!located) return null;
      const { workspace, issue } = located;

      const target = input.state;
      // Idempotency: skip the write entirely if the issue is already at the target state.
      if (target.kind === 'byType' && issue.state.type === target.stateType) {
        return parseIssue(issue, workspace);
      }
      if (target.kind === 'byName' && issue.state.name.toLowerCase() === target.name.toLowerCase()) {
        return parseIssue(issue, workspace);
      }

      const states = await this.#listWorkflowStates(workspace, issue.team.id);
      let matched: LinearWorkflowState | undefined;
      if (target.kind === 'byType') {
        matched = states
          .slice()
          .sort((a, b) => a.position - b.position)
          .find(s => s.type === target.stateType);
      } else {
        const wanted = target.name.toLowerCase();
        matched = states.find(s => s.name.toLowerCase() === wanted);
      }
      if (!matched) {
        logPlatformWarn('Platform Linear: no workflow state matched target; skipping updateIssue.', {
          workspaceId: workspace.linearWorkspaceId,
          connectionId: workspace.connectionId,
          teamId: issue.team.id,
          target,
        });
        return null;
      }

      try {
        await this.#apiFor(workspace).updateIssueState(issue.id, matched.id);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }

      const refreshed = await this.#findIssue(input.sourceId, input.issueId);
      return refreshed ? parseIssue(refreshed.issue, refreshed.workspace) : null;
    },
  };

  readonly #rules: LinearEventRules;

  get rules(): LinearEventRules {
    return this.#rules;
  }

  constructor({ rules }: { rules?: LinearRuleOverrides } = {}) {
    this.#rules = resolveLinearRules(rules);
    const config = platformApiClientConfigFromEnv();
    this.#client = new PlatformApiClient(config);
    this.#endpointHost = new URL(config.baseUrl).host;
  }

  get storage(): LinearStorageHandle {
    return {
      integrationId: this.id,
      connections: {
        get: async (orgId: string) => {
          const row = await this.loadConnection(orgId);
          if (!row) return null;
          return {
            id: row.id,
            orgId,
            userId: null,
            data: {
              accessToken: row.accessToken,
              refreshToken: null,
              expiresAtMs: null,
              scope: row.scope,
              workspaceName: row.workspaceName,
              workspaceUrlKey: row.workspaceUrlKey,
            } satisfies LinearConnectionData,
            metadata: {},
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        },
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

  async listConnections(): Promise<PlatformLinearConnection[]> {
    const result = await this.#client.request<{ connections: PlatformLinearConnection[] }>(
      'GET',
      `/v2/connections?providerKey=${encodeURIComponent(PROVIDER_KEY)}`,
    );
    return result.connections;
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.listConnections()).some(connection => connection.status === 'active');
  }

  clearCaches(): void {
    this.#organizationByConnectionId.clear();
    this.#workflowStatesByTeam.clear();
  }

  /**
   * Compatibility row for the shared Linear routes/rules. The token names the
   * first active Connect connection; Platform holds the real OAuth credential.
   */
  async loadConnection(orgId: string): Promise<LinearConnectionRow | null> {
    const workspace = (await this.#listWorkspaces())[0];
    if (!workspace) return null;
    const now = new Date();
    return {
      id: `platform-linear:${workspace.connectionId}`,
      orgId,
      userId: null,
      accessToken: linearConnectionToken(workspace.connectionId),
      scope: 'read,write',
      refreshToken: null,
      expiresAt: null,
      workspaceName: workspace.linearWorkspaceName,
      workspaceUrlKey: workspace.urlKey,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getFreshAccessToken(connection: LinearConnectionRow): Promise<string> {
    return connection.accessToken;
  }

  /**
   * Background-dispatch context. Linear work items store the issue UUID
   * directly as `externalId`; the issue's workspace is resolved per call.
   */
  async #resolveIntakeDispatch({
    orgId,
    externalSource,
  }: {
    orgId: string;
    externalSource: { type: string; externalId: string };
  }): Promise<{ connection: IntegrationConnection; issueId: string } | null> {
    if (externalSource.type !== 'issue') return null;
    const connection = await this.loadConnection(orgId);
    if (!connection) return null;
    return {
      connection: { type: 'oauth', accessToken: connection.accessToken },
      issueId: externalSource.externalId,
    };
  }

  canPostComments(connection: LinearConnectionRow): boolean {
    return connection.accessToken.startsWith(CONNECTION_TOKEN_PREFIX);
  }

  async checkConnection(orgId: string): Promise<LinearConnectionCheck> {
    const connection = await this.loadConnection(orgId);
    return {
      connected: connection !== null,
      canComment: connection !== null,
      canCreateIssues: connection !== null,
      checkedAt: Date.now(),
    };
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    if (!linearIssueReconciliationEnabled()) return [];
    const reconcile = attachLinearIssueReconciler(this, ctx);
    if (!reconcile) return [];
    const intervalMs = linearIssueReconciliationInterval();
    return [
      new IssueReconcileWorker({
        integrationId: this.id,
        reconcile,
        ...(intervalMs ? { intervalMs } : {}),
      }),
    ];
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    // Connecting happens through the shared Platform Connect routes
    // (`/web/integrations/platform/linear/*`), so the OAuth routes are dropped.
    return buildLinearRoutes({
      auth: ctx.auth,
      linear: this as unknown as LinearIntegration,
      stateSigner: ctx.stateSigner,
      baseUrl: ctx.baseUrl,
      intake: ctx.storage.intake,
      projects: ctx.storage.projects,
      ingestFactoryIssues: attachLinearRules(this, ctx),
      workItems: ctx.runtime?.workItems,
      boards: ctx.runtime?.boards,
      platformStatus: async () => ({
        mode: 'platform',
        connections: (await this.listConnections()).map(({ id, status, accountLabel }) => ({
          id,
          status,
          accountLabel,
        })),
      }),
    }).filter(route => !route.path.startsWith('/auth/linear/'));
  }

  async agentTools({ requestContext }: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildPlatformLinearAgentTools({ requestContext, linear: this });
  }

  /**
   * Teams across every Linear workspace, for agent-side team resolution. A
   * workspace authorized by several connections is listed once, through its
   * first connection.
   */
  async listAllTeams(): Promise<
    Array<LinearTeam & { workspaceId: string; workspaceName: string; connectionId: string }>
  > {
    const workspaces = uniqueWorkspaces(await this.#listWorkspaces());
    return (await this.#listTeamSources(workspaces)).map(({ workspace, team }) => ({
      ...team,
      workspaceId: workspace.linearWorkspaceId,
      workspaceName: workspace.linearWorkspaceName,
      connectionId: workspace.connectionId,
    }));
  }

  async createIssue(
    connectionId: string,
    input: { teamId: string; title: string; description?: string; priority?: number },
  ): Promise<LinearCreatedIssue> {
    return new LinearProxyApi(this.#client, connectionId).createIssue(input);
  }

  /** Locate an issue across connections and return its detail, or null. */
  async getIssueDetail(idOrIdentifier: string): Promise<LinearRouteIssueDetail | null> {
    return this.fetchIssueDetail('', idOrIdentifier);
  }

  /** Comment on an issue in whichever connection owns it. */
  async commentOnIssue(idOrIdentifier: string, body: string): Promise<{ id: string; url: string } | null> {
    const workspace = await this.#resolveWorkspaceForIssue(undefined, idOrIdentifier);
    if (!workspace) return null;
    return this.#apiFor(workspace).createComment(idOrIdentifier, body);
  }

  /**
   * The connection a source was bound through. Source ids stored before
   * connections were stamped only name the Linear workspace; those use the
   * workspace's first active connection.
   */
  async #workspaceFor(source: { workspaceId: string; connectionId: string | null }): Promise<LinearWorkspace> {
    const workspaces = await this.#listWorkspaces();
    const workspace =
      (source.connectionId && workspaces.find(candidate => candidate.connectionId === source.connectionId)) ||
      workspaces.find(candidate => candidate.linearWorkspaceId === source.workspaceId);
    if (!workspace) {
      throw new PlatformApiError('Linear connection is unavailable or requires reauthentication.', 401);
    }
    return workspace;
  }

  #apiFor(workspace: LinearWorkspace): LinearProxyApi {
    return new LinearProxyApi(this.#client, workspace.connectionId);
  }

  diagnostics(): Record<string, unknown> {
    return { mode: 'platform', endpointHost: this.#endpointHost };
  }

  async listProjects(): Promise<Array<LinearProject & { workspaceId: string }>> {
    return (await this.#listProjectSources()).map(({ workspace, project }) => ({
      ...project,
      id: encodeSourceId(workspace, project.id),
      workspaceId: workspace.linearWorkspaceId,
    }));
  }

  async listTeams(_accessToken: string): Promise<Array<LinearTeam & { workspaceId: string; sourceId: string }>> {
    return (await this.#listTeamSources()).map(({ workspace, team }) => ({
      ...team,
      workspaceId: workspace.linearWorkspaceId,
      sourceId: encodeTeamSourceId(workspace, team.id),
    }));
  }

  async fetchIssueDetail(
    _accessToken: string,
    idOrIdentifier: string,
    sourceIds?: string[],
    routedSourceIds?: string[],
  ): Promise<LinearRouteIssueDetail | null> {
    const located = await this.#findIssue(undefined, idOrIdentifier, sourceIds, routedSourceIds);
    if (!located) return null;
    const comments = await this.#loadComments(located.workspace, located.issue.id, located.issue.comments);
    const issue = located.issue;
    return {
      id: issue.id,
      projectId: issue.project?.id ?? null,
      workspaceId: located.workspace.linearWorkspaceId,
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

  async #listProjectSources(workspaces?: LinearWorkspace[]): Promise<ProjectSource[]> {
    const scopedWorkspaces = workspaces ?? (await this.#listWorkspaces());
    const projectGroups = await Promise.all(
      scopedWorkspaces.map(async workspace => {
        const projects: LinearProject[] = [];
        let after: string | undefined;
        for (let page = 0; page < MAX_REFERENCE_PAGES; page += 1) {
          const result = await this.#apiFor(workspace).listProjects(after);
          projects.push(...result.projects);
          if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
          // A page that hands back the cursor it was asked for would replay forever.
          if (result.pageInfo.endCursor === after) throw invalidLinearCursor();
          after = result.pageInfo.endCursor;
        }
        return projects.map(project => ({ workspace, project }));
      }),
    );
    return projectGroups.flat();
  }

  async #listTeamSources(workspaces?: LinearWorkspace[]): Promise<TeamSource[]> {
    const scopedWorkspaces = workspaces ?? (await this.#listWorkspaces());
    const teamGroups = await Promise.all(
      scopedWorkspaces.map(async workspace => {
        const teams: LinearTeam[] = [];
        let after: string | undefined;
        for (let page = 0; page < MAX_REFERENCE_PAGES; page += 1) {
          const result = await this.#apiFor(workspace).listTeams(after);
          teams.push(...result.teams);
          if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
          // A page that hands back the cursor it was asked for would replay forever.
          if (result.pageInfo.endCursor === after) throw invalidLinearCursor();
          after = result.pageInfo.endCursor;
        }
        return teams.map(team => ({ workspace, team }));
      }),
    );
    return teamGroups.flat();
  }

  async listWorkspaces(): Promise<LinearWorkspace[]> {
    return this.#listWorkspaces();
  }

  async #listWorkspaces(): Promise<LinearWorkspace[]> {
    const connections = (await this.listConnections()).filter(connection => connection.status === 'active');
    const workspaces = await Promise.all(
      connections.map(async connection => {
        let organization = this.#organizationByConnectionId.get(connection.id);
        if (!organization) {
          organization = await new LinearProxyApi(this.#client, connection.id).organization();
          this.#organizationByConnectionId.set(connection.id, organization);
        }
        return {
          linearWorkspaceId: organization.id,
          linearWorkspaceName: organization.name,
          urlKey: organization.urlKey,
          connected: true,
          connectionId: connection.id,
          accountLabel: connection.accountLabel,
        } satisfies LinearWorkspace;
      }),
    );
    return workspaces;
  }

  async #listIssues(sourceIds: string[], cursor?: string, labels?: string[], attributionSourceIds = sourceIds) {
    type ListedIssue = { issue: LinearIssue; sourceId: string; workspace: LinearWorkspace };
    if (sourceIds.length === 0) return { issues: [] as ListedIssue[], nextCursor: null };

    // Resolve every selected source to the connection it was bound through.
    // Project and team sources are listed separately: a project source filters
    // by `projectId`, a team source filters by `teamId` (and returns projectless
    // issues too). Filters are never combined on one request.
    type Descriptor = {
      kind: 'project' | 'team';
      sourceId: string;
      workspace: LinearWorkspace;
      filter: { projectId?: string; teamId?: string };
    };
    const descriptors: Descriptor[] = [];
    for (const sourceId of sourceIds) {
      const source = parseSourceId(sourceId);
      let workspace: LinearWorkspace;
      try {
        workspace = await this.#workspaceFor(source);
      } catch (error) {
        if (error instanceof PlatformApiError && error.status === 401) continue;
        throw error;
      }
      descriptors.push({
        kind: source.kind,
        sourceId,
        workspace,
        filter: source.kind === 'project' ? { projectId: source.projectId } : { teamId: source.teamId },
      });
    }
    const selectedProjectIdsByWorkspace = new Map<string, Set<string>>();
    for (const attributionSourceId of attributionSourceIds) {
      const source = parseSourceId(attributionSourceId);
      if (source.kind !== 'project') continue;
      const selectedProjectIds = selectedProjectIdsByWorkspace.get(source.workspaceId) ?? new Set<string>();
      selectedProjectIds.add(source.projectId);
      selectedProjectIdsByWorkspace.set(source.workspaceId, selectedProjectIds);
    }

    const cursors = await decodeCursor(cursor, sourceIds, attributionSourceIds);
    const normalizedLabels = normalizeLabels(labels);
    const nextState: Record<string, string | null> = {};
    let hasNextPage = false;
    const pages = await Promise.all(
      descriptors.map(async ({ kind, sourceId, workspace, filter }) => {
        if (cursors[sourceId] === null) {
          nextState[sourceId] = null;
          return [] as ListedIssue[];
        }
        const after = cursors[sourceId];
        const result = await this.#apiFor(workspace).listIssues({
          first: PAGE_SIZE,
          ...(after ? { after } : {}),
          ...filter,
        });
        const next = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
        // A page that hands back the cursor it was asked for would replay forever.
        if (next !== null && next === after) throw invalidLinearCursor();
        nextState[sourceId] = next;
        hasNextPage ||= next !== null;
        return result.issues
          .filter(
            issue => normalizedLabels.length === 0 || issue.labels.some(label => normalizedLabels.includes(label.name)),
          )
          .filter(
            issue =>
              kind === 'project' ||
              issue.project === null ||
              !selectedProjectIdsByWorkspace.get(workspace.linearWorkspaceId)?.has(issue.project.id),
          )
          .map(issue => ({ issue, sourceId, workspace }));
      }),
    );
    return {
      issues: dedupeIssuesBySource(pages.flat(), sourceIds),
      nextCursor: hasNextPage ? await encodeCursor(nextState, sourceIds, attributionSourceIds) : null,
    };
  }

  async #findIssue(
    sourceId: string | undefined,
    issueId: string,
    sourceIds?: string[],
    routedSourceIds?: string[],
  ): Promise<{
    workspace: LinearWorkspace;
    issue: IssueWithComments;
  } | null> {
    const scopedSourceIds = sourceIds ?? (sourceId ? [sourceId] : undefined);
    const scopedSources = scopedSourceIds?.map(sourceKey => ({
      sourceKey,
      source: parseSourceId(sourceKey),
    }));
    const routedSourceSet = routedSourceIds ? new Set(routedSourceIds) : undefined;
    const workspaces = routedSourceIds
      ? await this.#workspacesForSources(routedSourceIds)
      : scopedSourceIds
        ? await this.#workspacesForSources(scopedSourceIds)
        : uniqueWorkspaces(await this.#listWorkspaces());
    for (const workspace of workspaces) {
      try {
        const issue = await this.#apiFor(workspace).getIssue(issueId, { comments: true });
        if (scopedSources) {
          const matching = scopedSources.filter(
            ({ source }) =>
              source.workspaceId === workspace.linearWorkspaceId &&
              (source.kind === 'team' ? issue.team.id === source.teamId : issue.project?.id === source.projectId),
          );
          const winner = matching.find(({ source }) => source.kind === 'project') ?? matching[0];
          if (!winner || (routedSourceSet && !routedSourceSet.has(winner.sourceKey))) continue;
        }
        return { workspace, issue };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    return null;
  }

  async #resolveWorkspaceForIssue(sourceId: string | undefined, issueId: string): Promise<LinearWorkspace | null> {
    if (sourceId) return this.#workspaceFor(parseSourceId(sourceId));
    const workspaces = uniqueWorkspaces(await this.#listWorkspaces());
    if (workspaces.length === 1) return workspaces[0]!;
    for (const workspace of workspaces) {
      try {
        await this.#apiFor(workspace).getIssue(issueId);
        return workspace;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    return null;
  }

  /** Connections behind the given sources, one per connection, skipping ones no longer active. */
  async #workspacesForSources(sourceIds: string[]): Promise<LinearWorkspace[]> {
    const byConnectionId = new Map<string, LinearWorkspace>();
    for (const sourceId of sourceIds) {
      try {
        const workspace = await this.#workspaceFor(parseSourceId(sourceId));
        byConnectionId.set(workspace.connectionId, workspace);
      } catch (error) {
        if (!(error instanceof PlatformApiError && error.status === 401)) throw error;
      }
    }
    return [...byConnectionId.values()];
  }

  async #listWorkflowStates(workspace: LinearWorkspace, teamId: string): Promise<LinearWorkflowState[]> {
    const cacheKey = `${workspace.linearWorkspaceId}:${teamId}`;
    const cached = this.#workflowStatesByTeam.get(cacheKey);
    if (cached) return cached;
    const states = await this.#apiFor(workspace).listWorkflowStates(teamId);
    this.#workflowStatesByTeam.set(cacheKey, states);
    return states;
  }

  async #loadComments(
    workspace: LinearWorkspace,
    issueId: string,
    embedded: { nodes: LinearComment[]; pageInfo: PageInfo } | undefined,
  ): Promise<LinearComment[]> {
    const comments = [...(embedded?.nodes ?? [])];
    let pageInfo = embedded?.pageInfo;
    let page = 0;
    while (pageInfo?.hasNextPage && pageInfo.endCursor && page < MAX_COMMENT_PAGES) {
      const result = await this.#apiFor(workspace).listComments(issueId, pageInfo.endCursor);
      comments.push(...result.comments);
      if (result.pageInfo.hasNextPage && result.pageInfo.endCursor === pageInfo.endCursor) throw invalidLinearCursor();
      pageInfo = result.pageInfo;
      page += 1;
    }
    return comments;
  }
}

function parseIssue(issue: LinearIssue, workspace: SourceOwner): IntakeIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    author: issue.creator?.displayName ?? issue.creator?.name ?? null,
    state: issue.state.name,
    stateType: issue.state.type,
    priority: issue.priorityLabel,
    assignee: issue.assignee?.displayName ?? issue.assignee?.name ?? null,
    source: issue.team.key,
    // Use the same workspace-scoped identity as listProjects and intake bindings.
    // The source may be a team, so it cannot stand in for the issue's project.
    projectId: issue.project ? encodeSourceId(workspace, issue.project.id) : null,
    labels: issue.labels.map(label => label.name),
    commentCount: null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function parseIssueDetail(issue: LinearIssue, comments: LinearComment[], workspace: SourceOwner): IntakeIssueDetail {
  return {
    ...parseIssue(issue, workspace),
    commentCount: comments.length,
    description: issue.description?.trim() ? issue.description : null,
    comments: comments.map(comment => ({
      author: comment.user?.displayName ?? comment.user?.name ?? null,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  };
}

/**
 * Deduplicate issues that surfaced from more than one selected source (a team
 * source and one of its projects both select the same issue). Keeps one entry
 * per Linear issue UUID.
 *
 * Tie-breaker — MOST-SPECIFIC-WINS: a project source beats a team source, so an
 * issue that belongs to a selected project is attributed to that project's
 * source (and therefore routes to the project's board). The team source covers
 * only the remainder — projectless issues and issues in projects that were not
 * separately selected. `selectionOrder` breaks a same-kind tie deterministically
 * by the order the sources were selected.
 *
 * This function is the single precedence point; change the comparison here to
 * change the routing policy.
 */
function dedupeIssuesBySource<T extends { issue: { id: string }; sourceId: string }>(
  entries: T[],
  selectionOrder: string[],
): T[] {
  const rank = new Map(selectionOrder.map((id, index) => [id, index]));
  const specificity = (sourceId: string): number => (parseSourceId(sourceId).kind === 'project' ? 0 : 1);
  const winners = new Map<string, T>();
  for (const entry of entries) {
    const existing = winners.get(entry.issue.id);
    if (!existing) {
      winners.set(entry.issue.id, entry);
      continue;
    }
    const bySpecificity = specificity(entry.sourceId) - specificity(existing.sourceId);
    const better =
      bySpecificity < 0 ||
      (bySpecificity === 0 &&
        (rank.get(entry.sourceId) ?? Number.MAX_SAFE_INTEGER) <
          (rank.get(existing.sourceId) ?? Number.MAX_SAFE_INTEGER));
    if (better) winners.set(entry.issue.id, entry);
  }
  // Preserve first-seen order of the surviving issues.
  const seen = new Set<string>();
  const ordered: T[] = [];
  for (const entry of entries) {
    if (seen.has(entry.issue.id)) continue;
    seen.add(entry.issue.id);
    ordered.push(winners.get(entry.issue.id)!);
  }
  return ordered;
}

/** Who a source id belongs to: the Linear workspace and the Connect connection it was bound through. */
type SourceOwner = Pick<LinearWorkspace, 'linearWorkspaceId' | 'connectionId'>;

/** One entry per Linear workspace, keeping each workspace's first connection. */
function uniqueWorkspaces(workspaces: LinearWorkspace[]): LinearWorkspace[] {
  const byWorkspaceId = new Map<string, LinearWorkspace>();
  for (const workspace of workspaces) {
    if (!byWorkspaceId.has(workspace.linearWorkspaceId)) byWorkspaceId.set(workspace.linearWorkspaceId, workspace);
  }
  return [...byWorkspaceId.values()];
}

const PROJECT_SOURCE_PREFIX = 'linear-project:';
const TEAM_SOURCE_PREFIX = 'linear-team:';

export function encodeSourceId(owner: SourceOwner, projectId: string): string {
  return encodePayload(PROJECT_SOURCE_PREFIX, owner, { projectId });
}

export function encodeTeamSourceId(owner: SourceOwner, teamId: string): string {
  return encodePayload(TEAM_SOURCE_PREFIX, owner, { teamId });
}

function encodePayload(prefix: string, owner: SourceOwner, ids: Record<string, string>): string {
  const payload = { connectionId: owner.connectionId, workspaceId: owner.linearWorkspaceId, ...ids };
  return `${prefix}${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

/**
 * Decode a source id payload. `connectionId` is absent from ids stored by the
 * legacy app-install integration, which only knew the Linear workspace.
 */
function decodePayload<K extends string>(
  sourceId: string,
  prefix: string,
  idKey: K,
  label: string,
): { workspaceId: string; connectionId: string | null } & Record<K, string> {
  const invalid = new Error(`Linear ${label} source id is invalid.`);
  if (!sourceId.startsWith(prefix)) throw invalid;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(sourceId.slice(prefix.length), 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    throw invalid;
  }
  const { workspaceId, connectionId } = parsed;
  const id = parsed[idKey];
  if (typeof workspaceId !== 'string' || !workspaceId || typeof id !== 'string' || !id) throw invalid;
  return {
    workspaceId,
    connectionId: typeof connectionId === 'string' && connectionId ? connectionId : null,
    [idKey]: id,
  } as { workspaceId: string; connectionId: string | null } & Record<K, string>;
}

export function decodeTeamSourceId(sourceId: string) {
  return decodePayload(sourceId, TEAM_SOURCE_PREFIX, 'teamId', 'team');
}

/**
 * A decoded intake source: either a Linear project or a whole Linear team.
 * Downstream code discriminates on `kind` to build the right issue-listing
 * filter and to apply most-specific-wins routing (project beats team).
 */
export type DecodedSource =
  | { kind: 'project'; workspaceId: string; connectionId: string | null; projectId: string }
  | { kind: 'team'; workspaceId: string; connectionId: string | null; teamId: string };

/** Discriminate any Linear source id by its prefix and decode it. */
export function parseSourceId(sourceId: string): DecodedSource {
  if (sourceId.startsWith(TEAM_SOURCE_PREFIX)) {
    return { kind: 'team', ...decodeTeamSourceId(sourceId) };
  }
  return { kind: 'project', ...decodePayload(sourceId, PROJECT_SOURCE_PREFIX, 'projectId', 'project') };
}

function normalizeLabels(labels: string[] | undefined): string[] {
  return [...new Set((labels ?? []).map(label => label.trim()).filter(Boolean))];
}

type PlatformListCursor = { v: 1; sourceSet: string; cursors: Array<string | null> };

function canonicalSourceIds(sourceIds: string[]): string[] {
  return [...new Set(sourceIds)].sort();
}

async function linearSourceSetFingerprint(sourceIds: string[], attributionSourceIds: string[]): Promise<string> {
  const scope = {
    sourceIds: canonicalSourceIds(sourceIds),
    attributionSourceIds: canonicalSourceIds(attributionSourceIds),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(scope));
  return Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', bytes)).toString('base64url');
}

function invalidLinearCursor(): Error {
  return Object.assign(new Error('Linear cursor is invalid or stale.'), { code: 'invalid_cursor' as const });
}

async function decodeCursor(
  cursor: string | undefined,
  sourceIds: string[],
  attributionSourceIds: string[],
): Promise<Record<string, string | null | undefined>> {
  if (!cursor) return {};
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<PlatformListCursor>;
    const canonical = canonicalSourceIds(sourceIds);
    if (
      parsed.v !== 1 ||
      parsed.sourceSet !== (await linearSourceSetFingerprint(sourceIds, attributionSourceIds)) ||
      !Array.isArray(parsed.cursors) ||
      parsed.cursors.length !== canonical.length ||
      !parsed.cursors.every(value => value === null || typeof value === 'string')
    ) {
      throw invalidLinearCursor();
    }
    return Object.fromEntries(canonical.map((sourceId, index) => [sourceId, parsed.cursors![index]]));
  } catch {
    throw invalidLinearCursor();
  }
}

async function encodeCursor(
  state: Record<string, string | null>,
  sourceIds: string[],
  attributionSourceIds: string[],
): Promise<string> {
  const canonical = canonicalSourceIds(sourceIds);
  const cursor: PlatformListCursor = {
    v: 1,
    sourceSet: await linearSourceSetFingerprint(sourceIds, attributionSourceIds),
    cursors: canonical.map(sourceId => state[sourceId] ?? null),
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function requireLinearConnection(connection: IntegrationConnection): void {
  if (connection.type !== 'oauth') {
    throw new Error('Linear capabilities require an OAuth connection.');
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof PlatformApiError && error.status === 404;
}

function optionalPositiveIntegerEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
