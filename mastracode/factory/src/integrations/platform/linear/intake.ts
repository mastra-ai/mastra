import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  CreatedIntakeComment,
  GetIntakeIssueInput,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeIssuePage,
  IntakeItemPage,
  IntakeSource,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ListIntakeSourcesInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../../capabilities/intake.js';
import {
  ACTIVE_ISSUE_STATE_TYPES,
  collectIssueComments,
  createComment,
  getIssue,
  getViewer,
  invalidLinearCursor,
  isLinearNotFound,
  linearFetchTransport,
  listAllProjects,
  listAllTeams,
  listIssues,
  listWorkflowStates,
  resolveIssueId,
  updateIssueState,
} from '../../linear/graphql.js';
import type {
  LinearGraphqlComment,
  LinearGraphqlIssue,
  LinearGraphqlIssueWithComments,
  LinearGraphqlProject,
  LinearGraphqlTeam,
  LinearGraphqlTransport,
  LinearGraphqlWorkflowState,
} from '../../linear/graphql.js';
import type { LinearWorkspaceListingError } from '../../linear/routes.js';
import { PlatformConnectionNotConnectedError } from '../foundation/connect-binding.js';
import type { PlatformConnection } from '../foundation/connect-binding.js';
import { PlatformIntakeCapability } from '../foundation/intake.js';
import type { PlatformConnectIntegration } from '../foundation/integration.js';
import { logPlatformWarn } from '../logging.js';
import { encodeSourceId, encodeTeamSourceId, parseSourceId } from './source-id.js';

/** The Linear workspace a connection reaches, from Linear's `viewer`. */
export interface LinearIdentity {
  linearWorkspaceId: string;
  name: string;
  urlKey: string;
  appUserId: string;
}

/** A Linear workspace served by one Platform `linear` connection. */
export interface LinearWorkspace {
  connectionId: string;
  linearWorkspaceId: string;
  linearWorkspaceName: string;
  urlKey: string | null;
  connected: boolean;
}

/** A second connection to a workspace another connection already serves. */
export interface LinearDuplicateConnection {
  connectionId: string;
  linearWorkspaceId: string;
  duplicateOf: string;
}

/** A project-linked `linear` connection Factory can't use until it is connected again. */
export interface LinearUnusableConnection {
  connectionId: string;
  accountLabel: string | null;
  /** The workspace, when Factory has seen this connection working before. */
  linearWorkspaceId: string | null;
  /** Nango can't reconnect an imported connection, so recovery is a fresh connect. */
  requiresFreshConnect: true;
}

export interface LinearConnectionInventory {
  /** One entry per connected workspace, sorted by workspace id. */
  workspaces: LinearWorkspace[];
  duplicates: LinearDuplicateConnection[];
  unusable: LinearUnusableConnection[];
}

type ProjectSource = { workspace: LinearWorkspace; project: LinearGraphqlProject };
type TeamSource = { workspace: LinearWorkspace; team: LinearGraphqlTeam };
type LocatedIssue = { workspace: LinearWorkspace; issue: LinearGraphqlIssueWithComments };

/** Intake connections carry no provider token: Platform Linear reaches every workspace through its connection. */
export const PLATFORM_MANAGED_CONNECTION_TOKEN = 'platform-managed';

const PAGE_SIZE = 30;
const REFERENCE_PAGE_SIZE = 100;
const MAX_REFERENCE_PAGES = 40;
const COMMENT_PAGE_SIZE = 50;
const COMMENT_FOLLOW_PAGE_SIZE = 200;
const MAX_COMMENT_PAGES = 20;

/**
 * Platform Linear's intake. Workspaces are the project-linked Platform
 * `linear` connections, each identified through Linear's `viewer`; every read
 * and write goes through that connection's GraphQL proxy. Source ids name the
 * workspace, not the connection, so they survive a workspace moving to a new
 * connection.
 */
export class PlatformLinearIntake extends PlatformIntakeCapability {
  readonly #integration: PlatformConnectIntegration;
  readonly #identities = new Map<string, Promise<LinearIdentity>>();
  /** Workflow states per `${workspaceId}:${teamId}`, for the process lifetime. */
  readonly #workflowStatesByTeam = new Map<string, LinearGraphqlWorkflowState[]>();

  readonly #unreachableWorkspaces: () => string | null;

  constructor(
    integration: PlatformConnectIntegration,
    options: {
      /** Why the org may have Linear workspaces Factory can't reach yet (e.g. a migration in progress), or null. */
      unreachableWorkspaces?: () => string | null;
    } = {},
  ) {
    super(integration, 'linear-connection:');
    this.#integration = integration;
    this.#unreachableWorkspaces = options.unreachableWorkspaces ?? (() => null);
  }

  protected notConnectedError(workspaceId: string): Error {
    return Object.assign(new Error(`Linear workspace ${workspaceId} is not connected to this Factory.`), {
      status: 401,
    });
  }

  clearCaches(): void {
    this.#identities.clear();
    this.#workflowStatesByTeam.clear();
  }

  /**
   * The project's `linear` connections as workspaces. Two connections to one
   * workspace resolve to the most recently connected one; the other is
   * reported as a duplicate.
   */
  async inventory(): Promise<LinearConnectionInventory> {
    const connections = await this.#integration.listConnections();
    const keys = new Set(connections.map(identityKey));
    for (const key of this.#identities.keys()) if (!keys.has(key)) this.#identities.delete(key);

    const unusable: LinearUnusableConnection[] = [];
    const identified: Array<{ connection: PlatformConnection; identity: LinearIdentity }> = [];
    await Promise.all(
      connections.map(async connection => {
        if (connection.status === 'active') {
          try {
            identified.push({ connection, identity: await this.#identity(connection) });
            return;
          } catch (error) {
            if (!(error instanceof PlatformConnectionNotConnectedError)) {
              logPlatformWarn('Platform Linear could not identify a connection; it is skipped until it answers.', {
                connectionId: connection.id,
                error: error instanceof Error ? error.message : String(error),
              });
              return;
            }
          }
        }
        unusable.push({
          connectionId: connection.id,
          accountLabel: connection.accountLabel,
          linearWorkspaceId: (await this.#cachedIdentity(connection))?.linearWorkspaceId ?? null,
          requiresFreshConnect: true,
        });
      }),
    );

    const byWorkspace = new Map<string, Array<{ connection: PlatformConnection; identity: LinearIdentity }>>();
    for (const entry of identified) {
      const group = byWorkspace.get(entry.identity.linearWorkspaceId) ?? [];
      group.push(entry);
      byWorkspace.set(entry.identity.linearWorkspaceId, group);
    }
    const workspaces: LinearWorkspace[] = [];
    const duplicates: LinearDuplicateConnection[] = [];
    for (const [linearWorkspaceId, group] of [...byWorkspace].sort(([a], [b]) => a.localeCompare(b))) {
      group.sort(
        (a, b) =>
          connectedAtMs(b.connection) - connectedAtMs(a.connection) || a.connection.id.localeCompare(b.connection.id),
      );
      const [winner, ...rest] = group;
      workspaces.push({
        connectionId: winner!.connection.id,
        linearWorkspaceId,
        linearWorkspaceName: winner!.identity.name,
        urlKey: winner!.identity.urlKey,
        connected: true,
      });
      for (const other of rest) {
        duplicates.push({ connectionId: other.connection.id, linearWorkspaceId, duplicateOf: winner!.connection.id });
      }
    }
    unusable.sort((a, b) => a.connectionId.localeCompare(b.connectionId));
    return { workspaces, duplicates, unusable };
  }

  /** The workspace an active project connection serves, or null when the project lists no such connection. */
  async connectionWorkspace(connectionId: string): Promise<LinearIdentity | null> {
    const connection = (await this.#integration.listConnections()).find(
      candidate => candidate.id === connectionId && candidate.status === 'active',
    );
    return connection ? this.#identity(connection) : null;
  }

  /** Connected workspaces, one per workspace. */
  async listWorkspaces(): Promise<LinearWorkspace[]> {
    return (await this.inventory()).workspaces;
  }

  async resolveIntakeDispatch({ externalSource }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    // Like Jira, an unreachable workspace surfaces from the read, not here: `null` tells the reconciler the card is gone.
    if (externalSource.type !== 'issue') return null;
    return {
      connection: { type: 'oauth', accessToken: PLATFORM_MANAGED_CONNECTION_TOKEN },
      issueId: externalSource.externalId,
    };
  }

  async listSources(_input?: ListIntakeSourcesInput): Promise<IntakeSource[]> {
    const [projectSources, teamSources] = await Promise.all([this.#listProjectSources(), this.#listTeamSources()]);
    const projects = projectSources.map(({ workspace, project }) => ({
      id: encodeSourceId(workspace.linearWorkspaceId, project.id),
      name: project.name,
      type: 'project' as const,
      metadata: {
        workspaceId: workspace.linearWorkspaceId,
        workspaceName: workspace.linearWorkspaceName,
        workspaceUrlKey: workspace.urlKey,
        state: project.state,
        teams: project.teams,
      },
    }));
    const teams = teamSources.map(({ workspace, team }) => ({
      id: encodeTeamSourceId(workspace.linearWorkspaceId, team.id),
      name: team.name,
      type: 'team' as const,
      metadata: {
        workspaceId: workspace.linearWorkspaceId,
        workspaceName: workspace.linearWorkspaceName,
        workspaceUrlKey: workspace.urlKey,
        teamKey: team.key,
      },
    }));
    return [...projects, ...teams];
  }

  async listItems({ sourceIds, attributionSourceIds, cursor }: ListIntakeItemsInput): Promise<IntakeItemPage> {
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
  }

  async listIssues({
    connection,
    sourceIds,
    attributionSourceIds,
    labels,
    cursor,
  }: ListIntakeIssuesInput): Promise<IntakeIssuePage> {
    requireLinearConnection(connection);
    const result = await this.#listIssues(sourceIds, cursor, labels, attributionSourceIds);
    return {
      issues: result.issues.map(({ issue, sourceId, workspace }) => ({
        ...parseIssue(issue, workspace.linearWorkspaceId),
        sourceId,
      })),
      nextCursor: result.nextCursor,
    };
  }

  async getIssue({ connection, sourceId, issueId }: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    requireLinearConnection(connection);
    const located = await this.#findIssue(sourceId, issueId);
    if (!located) return null;
    const comments = await this.#loadComments(located);
    return parseIssueDetail(located.issue, comments, located.workspace.linearWorkspaceId);
  }

  async createComment({
    connection,
    sourceId,
    issueId,
    body,
  }: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
    requireLinearConnection(connection);
    const target = await this.#resolveIssue(sourceId, issueId);
    if (!target) return null;
    try {
      const comment = await createComment(this.#transport(target.workspace), { issueId: target.issueId, body });
      return { id: comment.id, url: comment.url };
    } catch (error) {
      if (isLinearNotFound(error)) return null;
      throw error;
    }
  }

  async updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    requireLinearConnection(input.connection);
    const located = await this.#findIssue(input.sourceId, input.issueId);
    if (!located) return null;
    const { workspace, issue } = located;
    const workspaceId = workspace.linearWorkspaceId;

    const target = input.state;
    // Idempotency: skip the write entirely if the issue is already at the target state.
    if (target.kind === 'byType' && issue.state.type === target.stateType) return parseIssue(issue, workspaceId);
    if (target.kind === 'byName' && issue.state.name.toLowerCase() === target.name.toLowerCase()) {
      return parseIssue(issue, workspaceId);
    }

    const states = await this.#listWorkflowStates(workspace, issue.team.id);
    let matched: LinearGraphqlWorkflowState | undefined;
    if (target.kind === 'byType') {
      matched = states
        .slice()
        .sort((a, b) => a.position - b.position)
        .find(state => state.type === target.stateType);
    } else {
      const wanted = target.name.toLowerCase();
      matched = states.find(state => state.name.toLowerCase() === wanted);
    }
    if (!matched) {
      logPlatformWarn('Platform Linear: no workflow state matched target; skipping updateIssue.', {
        workspaceId,
        teamId: issue.team.id,
        target,
      });
      return null;
    }

    try {
      await updateIssueState(this.#transport(workspace), { issueId: issue.id, stateId: matched.id });
    } catch (error) {
      if (isLinearNotFound(error)) return null;
      throw error;
    }

    const refreshed = await this.#findIssue(input.sourceId, input.issueId);
    return refreshed ? parseIssue(refreshed.issue, refreshed.workspace.linearWorkspaceId) : null;
  }

  /** Every connected workspace's projects, each with its workspace-scoped source id as `id`. */
  async listProjects(
    errors?: LinearWorkspaceListingError[],
  ): Promise<Array<LinearGraphqlProject & { workspaceId: string }>> {
    return (await this.#listProjectSources(undefined, errors)).map(({ workspace, project }) => ({
      ...project,
      id: encodeSourceId(workspace.linearWorkspaceId, project.id),
      workspaceId: workspace.linearWorkspaceId,
    }));
  }

  async listTeams(
    errors?: LinearWorkspaceListingError[],
  ): Promise<Array<LinearGraphqlTeam & { workspaceId: string; sourceId: string }>> {
    return (await this.#listTeamSources(undefined, errors)).map(({ workspace, team }) => ({
      ...team,
      workspaceId: workspace.linearWorkspaceId,
      sourceId: encodeTeamSourceId(workspace.linearWorkspaceId, team.id),
    }));
  }

  /** An issue with all its comments, found in the workspaces the source ids name (or every workspace). */
  async issueWithComments(
    idOrIdentifier: string,
    sourceIds?: string[],
    routedSourceIds?: string[],
  ): Promise<{ workspaceId: string; issue: LinearGraphqlIssue; comments: LinearGraphqlComment[] } | null> {
    const located = await this.#findIssue(undefined, idOrIdentifier, sourceIds, routedSourceIds);
    if (!located) return null;
    const comments = await this.#loadComments(located);
    return { workspaceId: located.workspace.linearWorkspaceId, issue: located.issue, comments };
  }

  /** The workspace a working connection reaches. Cached per connection until it is reconnected. */
  #identity(connection: PlatformConnection): Promise<LinearIdentity> {
    const key = identityKey(connection);
    let identity = this.#identities.get(key);
    if (!identity) {
      identity = getViewer(this.#connectionTransport(connection.id)).then(viewer => ({
        linearWorkspaceId: viewer.workspace.id,
        name: viewer.workspace.name,
        urlKey: viewer.workspace.urlKey,
        appUserId: viewer.appUserId,
      }));
      this.#identities.set(key, identity);
      identity.catch(() => {
        if (this.#identities.get(key) === identity) this.#identities.delete(key);
      });
    }
    return identity;
  }

  async #cachedIdentity(connection: PlatformConnection): Promise<LinearIdentity | null> {
    return (await this.#identities.get(identityKey(connection))?.catch(() => null)) ?? null;
  }

  #connectionTransport(connectionId: string): LinearGraphqlTransport {
    const binding = this.#integration.binding;
    return linearFetchTransport({ url: `${binding.proxyBaseUrl(connectionId)}/graphql`, fetch: binding.proxyFetch() });
  }

  #transport(workspace: LinearWorkspace): LinearGraphqlTransport {
    return this.#connectionTransport(workspace.connectionId);
  }

  async #listProjectSources(
    workspaceIds?: ReadonlySet<string>,
    errors?: LinearWorkspaceListingError[],
  ): Promise<ProjectSource[]> {
    const workspaces = scoped(await this.listWorkspaces(), workspaceIds);
    const groups = await Promise.allSettled(
      workspaces.map(async workspace =>
        (
          await listAllProjects(this.#transport(workspace), {
            pageSize: REFERENCE_PAGE_SIZE,
            maxPages: MAX_REFERENCE_PAGES,
          })
        ).map(project => ({ workspace, project })),
      ),
    );
    return collectWorkspaceListings(workspaces, groups, errors);
  }

  async #listTeamSources(
    workspaceIds?: ReadonlySet<string>,
    errors?: LinearWorkspaceListingError[],
  ): Promise<TeamSource[]> {
    const workspaces = scoped(await this.listWorkspaces(), workspaceIds);
    const groups = await Promise.allSettled(
      workspaces.map(async workspace =>
        (
          await listAllTeams(this.#transport(workspace), {
            pageSize: REFERENCE_PAGE_SIZE,
            maxPages: MAX_REFERENCE_PAGES,
          })
        ).map(team => ({ workspace, team })),
      ),
    );
    return collectWorkspaceListings(workspaces, groups, errors);
  }

  async #listIssues(sourceIds: string[], cursor?: string, labels?: string[], attributionSourceIds = sourceIds) {
    type ListedIssue = { issue: LinearGraphqlIssue; sourceId: string; workspace: LinearWorkspace };
    if (sourceIds.length === 0) return { issues: [] as ListedIssue[], nextCursor: null };

    // Resolve every selected source to a concrete listing descriptor. Project
    // and team sources are listed separately: a project source filters by
    // project, a team source filters by team (and returns projectless issues
    // too). Filters are never combined on one request.
    const parsedSources = sourceIds.map(sourceId => parseSourceId(sourceId));
    const projectWorkspaceIds = new Set(
      parsedSources.flatMap(source => (source.kind === 'project' ? [source.workspaceId] : [])),
    );
    const teamWorkspaceIds = new Set(
      parsedSources.flatMap(source => (source.kind === 'team' ? [source.workspaceId] : [])),
    );
    const [projectsResult, teamsResult] = await Promise.allSettled([
      projectWorkspaceIds.size > 0
        ? this.#listProjectSources(projectWorkspaceIds)
        : Promise.resolve([] as ProjectSource[]),
      teamWorkspaceIds.size > 0 ? this.#listTeamSources(teamWorkspaceIds) : Promise.resolve([] as TeamSource[]),
    ]);
    if (projectsResult.status === 'rejected' && (teamWorkspaceIds.size === 0 || teamsResult.status === 'rejected')) {
      throw projectsResult.reason;
    }
    if (teamsResult.status === 'rejected' && projectWorkspaceIds.size === 0) throw teamsResult.reason;
    const projectSources = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
    const teamSources = teamsResult.status === 'fulfilled' ? teamsResult.value : [];
    const projectMap = new Map(
      projectSources.map(source => [encodeSourceId(source.workspace.linearWorkspaceId, source.project.id), source]),
    );
    const teamMap = new Map(
      teamSources.map(source => [encodeTeamSourceId(source.workspace.linearWorkspaceId, source.team.id), source]),
    );

    type Descriptor = {
      kind: 'project' | 'team';
      sourceId: string;
      workspace: LinearWorkspace;
      filter: { projectIds: string[] } | { teamIds: string[] };
    };
    const descriptors: Descriptor[] = [];
    const selectedProjectIdsByWorkspace = new Map<string, Set<string>>();
    for (const attributionSourceId of attributionSourceIds) {
      const source = parseSourceId(attributionSourceId);
      if (source.kind !== 'project') continue;
      const selectedProjectIds = selectedProjectIdsByWorkspace.get(source.workspaceId) ?? new Set<string>();
      selectedProjectIds.add(source.projectId);
      selectedProjectIdsByWorkspace.set(source.workspaceId, selectedProjectIds);
    }
    for (const sourceId of sourceIds) {
      const projectSource = projectMap.get(sourceId);
      if (projectSource) {
        const workspaceId = projectSource.workspace.linearWorkspaceId;
        const selectedProjectIds = selectedProjectIdsByWorkspace.get(workspaceId) ?? new Set<string>();
        selectedProjectIds.add(projectSource.project.id);
        selectedProjectIdsByWorkspace.set(workspaceId, selectedProjectIds);
        descriptors.push({
          kind: 'project',
          sourceId,
          workspace: projectSource.workspace,
          filter: { projectIds: [projectSource.project.id] },
        });
        continue;
      }
      const teamSource = teamMap.get(sourceId);
      if (teamSource) {
        descriptors.push({
          kind: 'team',
          sourceId,
          workspace: teamSource.workspace,
          filter: { teamIds: [teamSource.team.id] },
        });
      }
    }

    const cursors = await decodeCursor(cursor, sourceIds, attributionSourceIds);
    const unfinished = descriptors.filter(({ sourceId }) => cursors[sourceId] !== null);
    const normalizedLabels = normalizeLabels(labels);
    const nextState: Record<string, string | null> = {};
    let hasNextPage = false;
    const pages = await Promise.allSettled(
      unfinished.map(async ({ kind, sourceId, workspace, filter }) => {
        const after = cursors[sourceId] ?? undefined;
        const result = await listIssues(this.#transport(workspace), {
          first: PAGE_SIZE,
          ...(after ? { after } : {}),
          ...filter,
          stateTypes: ACTIVE_ISSUE_STATE_TYPES,
        });
        const next = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
        // A page that hands back the cursor it was asked for would replay forever.
        if (next !== null && next === after) throw invalidLinearCursor();
        nextState[sourceId] = next;
        hasNextPage ||= next !== null;
        return result.nodes
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
      // A failed workspace is retried from the start on the next intake poll;
      // successful workspaces can finish their own pagination in this cycle.
      issues: dedupeIssuesBySource(
        collectWorkspaceListings(
          unfinished.map(source => source.workspace),
          pages,
        ),
        sourceIds,
      ),
      nextCursor: hasNextPage ? await encodeCursor(nextState, sourceIds, attributionSourceIds) : null,
    };
  }

  async #findIssue(
    sourceId: string | undefined,
    issueId: string,
    sourceIds?: string[],
    routedSourceIds?: string[],
  ): Promise<LocatedIssue | null> {
    const scopedSourceIds = sourceIds ?? (sourceId ? [sourceId] : undefined);
    const scopedSources = scopedSourceIds?.map(sourceKey => ({ sourceKey, source: parseSourceId(sourceKey) }));
    const routedSourceSet = routedSourceIds ? new Set(routedSourceIds) : undefined;
    const workspaces = await this.listWorkspaces();
    const workspaceIds = routedSourceIds
      ? [...new Set(routedSourceIds.map(sourceKey => parseSourceId(sourceKey).workspaceId))]
      : scopedSources
        ? [...new Set(scopedSources.map(({ source }) => source.workspaceId))]
        : workspaces.map(workspace => workspace.linearWorkspaceId);
    for (const workspaceId of workspaceIds) {
      const workspace = workspaces.find(candidate => candidate.linearWorkspaceId === workspaceId);
      // An unreachable workspace is not a deleted issue: callers close cards on `null`.
      if (!workspace) throw this.notConnectedError(workspaceId);
      const issue = await getIssue(this.#transport(workspace), issueId, { commentsFirst: COMMENT_PAGE_SIZE });
      if (!issue) continue;
      if (scopedSources) {
        const matching = scopedSources.filter(
          ({ source }) =>
            source.workspaceId === workspaceId &&
            (source.kind === 'team' ? issue.team.id === source.teamId : issue.project?.id === source.projectId),
        );
        const winner = matching.find(({ source }) => source.kind === 'project') ?? matching[0];
        if (!winner || (routedSourceSet && !routedSourceSet.has(winner.sourceKey))) continue;
      }
      return { workspace, issue };
    }
    if (!scopedSources) await this.#assertEveryWorkspaceReachable(issueId);
    return null;
  }

  /**
   * An unscoped lookup searches every connected workspace. Not finding the
   * issue means it is gone only if no workspace is out of reach; otherwise the
   * issue may live in one Factory can't see yet, and callers close cards on `null`.
   */
  async #assertEveryWorkspaceReachable(issueId: string): Promise<void> {
    const pending = this.#unreachableWorkspaces();
    const unusable = (await this.inventory()).unusable.length;
    const reason = pending ?? (unusable > 0 ? `${unusable} Linear connection(s) need a fresh connect` : null);
    if (!reason) return;
    throw Object.assign(new Error(`Linear issue ${issueId} was not found in a reachable workspace: ${reason}.`), {
      status: 401,
    });
  }

  /** The workspace that has the issue, and the issue's UUID (writes don't accept identifiers). */
  async #resolveIssue(
    sourceId: string | undefined,
    issueId: string,
  ): Promise<{ workspace: LinearWorkspace; issueId: string } | null> {
    const workspaces = await this.listWorkspaces();
    let candidates = workspaces;
    if (sourceId) {
      const workspaceId = parseSourceId(sourceId).workspaceId;
      const workspace = workspaces.find(candidate => candidate.linearWorkspaceId === workspaceId);
      if (!workspace) throw this.notConnectedError(workspaceId);
      candidates = [workspace];
    }
    for (const workspace of candidates) {
      const resolved = await resolveIssueId(this.#transport(workspace), issueId);
      if (resolved) return { workspace, issueId: resolved };
    }
    if (!sourceId) await this.#assertEveryWorkspaceReachable(issueId);
    return null;
  }

  async #listWorkflowStates(workspace: LinearWorkspace, teamId: string): Promise<LinearGraphqlWorkflowState[]> {
    const cacheKey = `${workspace.linearWorkspaceId}:${teamId}`;
    const cached = this.#workflowStatesByTeam.get(cacheKey);
    if (cached) return cached;
    const states = await listWorkflowStates(this.#transport(workspace), teamId);
    if (states.length > 0) this.#workflowStatesByTeam.set(cacheKey, states);
    return states;
  }

  #loadComments({ workspace, issue }: LocatedIssue): Promise<LinearGraphqlComment[]> {
    // The first page comes embedded in the issue; up to MAX_COMMENT_PAGES more follow.
    return collectIssueComments(this.#transport(workspace), issue.id, issue.comments, {
      pageSize: COMMENT_FOLLOW_PAGE_SIZE,
      maxPages: MAX_COMMENT_PAGES + 1,
    });
  }
}

function identityKey(connection: PlatformConnection): string {
  // A reconnect can authorize another workspace; its new `connectedAt` drops the old identity.
  return `${connection.id}:${connection.connectedAt ?? ''}`;
}

function connectedAtMs(connection: PlatformConnection): number {
  const ms = connection.connectedAt ? Date.parse(connection.connectedAt) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

function scoped(workspaces: LinearWorkspace[], workspaceIds: ReadonlySet<string> | undefined): LinearWorkspace[] {
  return workspaceIds ? workspaces.filter(workspace => workspaceIds.has(workspace.linearWorkspaceId)) : workspaces;
}

export function parseIssue(issue: LinearGraphqlIssue, workspaceId: string): IntakeIssue {
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
    projectId: issue.project ? encodeSourceId(workspaceId, issue.project.id) : null,
    labels: issue.labels.map(label => label.name),
    commentCount: null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function parseIssueDetail(
  issue: LinearGraphqlIssue,
  comments: LinearGraphqlComment[],
  workspaceId: string,
): IntakeIssueDetail {
  return {
    ...parseIssue(issue, workspaceId),
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

/** A provider outage in one workspace must not hide sources from the others. */
function collectWorkspaceListings<T>(
  workspaces: LinearWorkspace[],
  results: PromiseSettledResult<T[]>[],
  errors?: LinearWorkspaceListingError[],
): T[] {
  const items: T[] = [];
  let firstFailure: unknown;
  let succeeded = false;
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      succeeded = true;
      items.push(...result.value);
      continue;
    }
    const workspace = workspaces[index]!;
    firstFailure ??= result.reason;
    errors?.push({ workspaceId: workspace.linearWorkspaceId, name: workspace.linearWorkspaceName });
    logPlatformWarn('Platform Linear workspace sources could not be loaded; intake will retry.', {
      workspaceId: workspace.linearWorkspaceId,
    });
  }
  if (!succeeded && firstFailure) throw firstFailure;
  return items;
}
