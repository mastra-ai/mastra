import type {
  LinearGraphqlComment,
  LinearGraphqlIssue,
  LinearGraphqlProject,
  LinearGraphqlTeam,
} from '../../linear/graphql.js';
import type { FakePlatform, FakeReply } from '../foundation/test-utils.js';
import { problem, startFakePlatform } from '../foundation/test-utils.js';

export type FakeLinearState = { id: string; name: string; type: string; position: number };

/** A Linear workspace as the fake serves it through a connection's GraphQL proxy. */
export interface FakeLinearWorkspace {
  id: string;
  name: string;
  urlKey: string;
  appUserId: string;
  projects: LinearGraphqlProject[];
  teams: LinearGraphqlTeam[];
  issues: LinearGraphqlIssue[];
  /** Comments per issue id, oldest first. */
  comments: Record<string, LinearGraphqlComment[]>;
  /** Workflow states per team id. */
  states: Record<string, FakeLinearState[]>;
}

/** A GraphQL operation the fake answered. */
export interface FakeLinearOperation {
  connectionId: string;
  workspaceId: string;
  operation: string;
  variables: Record<string, unknown>;
}

export type FakeLinearOverride = (variables: Record<string, unknown>) => FakeReply | undefined;

const pageInfo = (hasNextPage: boolean, endCursor: string | null) => ({ hasNextPage, endCursor });

/**
 * Mastra Connect serving Linear, on top of {@link FakePlatform}: `linear`
 * connections whose GraphQL proxy answers from in-memory workspaces, and the
 * platform's Linear migration routes over workspaces still on legacy tokens.
 */
export class FakeLinear {
  readonly operations: FakeLinearOperation[] = [];
  /** Replies per `${workspaceId}:${operation}`, in place of the fake's answer when they return one. */
  readonly overrides = new Map<string, FakeLinearOverride>();
  /** Workspaces the platform still holds legacy tokens for, by workspace id. */
  readonly legacy = new Map<string, FakeLinearWorkspace>();
  /** Replies for the next migrate calls, in place of migrating. */
  readonly nextMigrateReplies: FakeReply[] = [];
  /** Replies for the next migration-status reads. */
  readonly nextStatusReplies: FakeReply[] = [];
  readonly migrateRequests: Array<{ linearWorkspaceIds?: string[] }> = [];

  readonly #byConnection = new Map<string, FakeLinearWorkspace>();
  /** Migrated workspaces: workspace id → connection id. */
  readonly #migrated = new Map<string, string>();

  constructor(readonly platform: FakePlatform) {
    platform.proxy = (connectionId, path, _query, body) => this.#proxy(connectionId, path, body);
    platform.route = (method, path, body) => this.#route(method, path, body);
  }

  /** Connects a workspace through Connect: a `linear` connection, linked to the project unless `linked: false`. */
  connect(
    workspace: FakeLinearWorkspace,
    options: { connectionId?: string; linked?: boolean; status?: string; connectedAt?: string } = {},
  ): string {
    const connectionId = options.connectionId ?? `conn-${workspace.id}`;
    this.#byConnection.set(connectionId, workspace);
    this.platform.orgConnections.push({
      id: connectionId,
      integrationId: 'linear',
      status: options.status ?? 'active',
      accountLabel: workspace.name,
      connectedAt: options.connectedAt ?? '2026-11-01T00:00:00.000Z',
    });
    if (options.linked ?? true) this.platform.linked.add(connectionId);
    return connectionId;
  }

  /** Leaves a workspace on the platform's legacy tokens, waiting for migration. */
  addLegacy(workspace: FakeLinearWorkspace): void {
    this.legacy.set(workspace.id, workspace);
  }

  setStatus(connectionId: string, status: string): void {
    const connection = this.platform.orgConnections.find(candidate => candidate.id === connectionId);
    if (!connection) throw new Error(`No connection ${connectionId}`);
    connection.status = status;
  }

  /** Deletes a connection on the platform: unlisted and unlinked; a migrated row still points at it. */
  dropConnection(connectionId: string): void {
    const index = this.platform.orgConnections.findIndex(candidate => candidate.id === connectionId);
    if (index === -1) throw new Error(`No connection ${connectionId}`);
    this.platform.orgConnections.splice(index, 1);
    this.platform.linked.delete(connectionId);
  }

  override(workspaceId: string, operation: string, reply: FakeLinearOverride): void {
    this.overrides.set(`${workspaceId}:${operation}`, reply);
  }

  ops(operation?: string): FakeLinearOperation[] {
    return operation ? this.operations.filter(op => op.operation === operation) : this.operations;
  }

  #proxy(connectionId: string, path: string, body: unknown): FakeReply {
    const workspace = this.#byConnection.get(connectionId);
    const connection = this.platform.orgConnections.find(candidate => candidate.id === connectionId);
    if (!workspace || !connection) return problem(404, 'not_found', `connection ${connectionId}`);
    if (connection.status === 'needs_reauth') {
      return problem(409, 'connection_needs_reauth', 'The connection needs to be reconnected.');
    }
    if (path !== '/graphql') return { status: 404, body: { errors: [{ message: `No route ${path}` }] } };
    const { query, variables = {} } = body as { query: string; variables?: Record<string, unknown> };
    const operation = /^\s*(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
    this.operations.push({ connectionId, workspaceId: workspace.id, operation, variables });
    const override = this.overrides.get(`${workspace.id}:${operation}`)?.(variables);
    if (override) return override;
    return this.#answer(workspace, operation, variables);
  }

  #answer(workspace: FakeLinearWorkspace, operation: string, variables: Record<string, unknown>): FakeReply {
    const data = (value: unknown): FakeReply => ({ status: 200, body: { data: value } });
    const notFound: FakeReply = {
      status: 200,
      body: { data: null, errors: [{ message: 'Entity not found', extensions: { code: 'ENTITY_NOT_FOUND' } }] },
    };
    const find = (idOrIdentifier: unknown) =>
      workspace.issues.find(issue => issue.id === idOrIdentifier || issue.identifier === idOrIdentifier);
    switch (operation) {
      case 'Viewer':
        return data({
          viewer: {
            id: workspace.appUserId,
            organization: { id: workspace.id, name: workspace.name, urlKey: workspace.urlKey },
          },
        });
      case 'Projects':
        return data({
          projects: paginate(
            workspace.projects.map(project => ({ ...project, teams: { nodes: project.teams } })),
            variables,
          ),
        });
      case 'Teams':
        return data({ teams: paginate(workspace.teams, variables) });
      case 'Intake': {
        const stateTypes = variables.stateTypes as string[];
        const projectIds = variables.projectIds as string[] | undefined;
        const teamIds = variables.teamIds as string[] | undefined;
        const issues = workspace.issues
          .filter(issue => stateTypes.includes(issue.state.type))
          .filter(issue => !projectIds || (issue.project !== null && projectIds.includes(issue.project.id)))
          .filter(issue => !teamIds || teamIds.includes(issue.team.id))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map(issueNode);
        return data({ issues: paginate(issues, variables) });
      }
      case 'IssueDetail': {
        const issue = find(variables.id);
        if (!issue) return notFound;
        const comments = workspace.comments[issue.id] ?? [];
        return data({
          issue: { ...issueNode(issue), comments: paginate(comments, { first: variables.commentsFirst }) },
        });
      }
      case 'IssueComments': {
        const issue = find(variables.id);
        if (!issue) return data({ issue: null });
        return data({ issue: { comments: paginate(workspace.comments[issue.id] ?? [], variables) } });
      }
      case 'IssueId': {
        const issue = find(variables.id);
        return issue ? data({ issue: { id: issue.id } }) : notFound;
      }
      case 'CommentCreate': {
        const input = variables.input as { issueId: string; body: string };
        const issue = workspace.issues.find(candidate => candidate.id === input.issueId);
        if (!issue) return notFound;
        const comments = (workspace.comments[issue.id] ??= []);
        const comment: LinearGraphqlComment = {
          id: `comment-${comments.length + 1}`,
          body: input.body,
          url: `${issue.url}#comment-${comments.length + 1}`,
          issue: { id: issue.id, identifier: issue.identifier },
          user: null,
          parent: null,
          createdAt: '2026-11-13T00:00:00.000Z',
          updatedAt: '2026-11-13T00:00:00.000Z',
        };
        comments.push(comment);
        return data({ commentCreate: { success: true, comment } });
      }
      case 'UpdateIssueState': {
        const issue = workspace.issues.find(candidate => candidate.id === variables.id);
        if (!issue) return notFound;
        const state = (workspace.states[issue.team.id] ?? []).find(candidate => candidate.id === variables.stateId);
        if (!state) return { status: 200, body: { data: { issueUpdate: { success: false } } } };
        issue.state = { id: state.id, name: state.name, type: state.type };
        return data({ issueUpdate: { success: true } });
      }
      case 'TeamStates': {
        const team = workspace.teams.find(
          candidate => candidate.id === variables.teamId || candidate.key === variables.teamId,
        );
        if (!team) return data({ team: null });
        return data({ team: { id: team.id, states: { nodes: workspace.states[team.id] ?? [] } } });
      }
      default:
        return { status: 400, body: { errors: [{ message: `Unknown operation ${operation}` }] } };
    }
  }

  #route(method: string, path: string, body: unknown): FakeReply | undefined {
    if (method === 'GET' && path === '/v2/integrations/linear/migration-status') {
      return this.nextStatusReplies.shift() ?? { status: 200, body: this.#status() };
    }
    if (method === 'POST' && path === '/v2/integrations/linear/migrate') {
      const input = (body ?? {}) as { linearWorkspaceIds?: string[] };
      this.migrateRequests.push(input);
      return this.nextMigrateReplies.shift() ?? { status: 200, body: this.#migrate(input.linearWorkspaceIds) };
    }
    return undefined;
  }

  #status() {
    return {
      pending: [...this.legacy.values()]
        .filter(workspace => !this.#migrated.has(workspace.id))
        .map(workspace => ({
          linearWorkspaceId: workspace.id,
          linearWorkspaceName: workspace.name,
          urlKey: workspace.urlKey,
        })),
      migrated: [...this.#migrated].map(([linearWorkspaceId, connectionId]) => ({
        linearWorkspaceId,
        connectionId,
        linkedToProject: this.platform.linked.has(connectionId),
      })),
    };
  }

  /** Imports each legacy workspace into Connect and links it to the project, as the platform does. */
  #migrate(linearWorkspaceIds: string[] | undefined) {
    const ids = linearWorkspaceIds ?? [...this.legacy.keys()];
    const connections = [];
    const skipped = [];
    for (const id of ids) {
      const workspace = this.legacy.get(id);
      if (!workspace) {
        skipped.push({ linearWorkspaceId: id, reason: 'not_connected' });
        continue;
      }
      let connectionId = this.#migrated.get(id);
      if (connectionId !== undefined && !this.platform.orgConnections.some(c => c.id === connectionId)) {
        skipped.push({ linearWorkspaceId: id, reason: 'connection_inactive' });
        continue;
      }
      const migrated = connectionId === undefined;
      if (connectionId === undefined) {
        connectionId = this.connect(workspace, { connectionId: `conn-migrated-${id}`, linked: false });
        this.#migrated.set(id, connectionId);
      }
      this.platform.linked.add(connectionId);
      connections.push({
        connectionId,
        linearWorkspaceId: id,
        linearWorkspaceName: workspace.name,
        urlKey: workspace.urlKey,
        linearAppUserId: workspace.appUserId,
        migrated,
      });
    }
    return { connections, skipped };
  }
}

function issueNode(issue: LinearGraphqlIssue) {
  return { ...issue, labels: { nodes: issue.labels } };
}

function paginate<T>(items: T[], variables: Record<string, unknown>) {
  const first = Number(variables.first ?? items.length);
  const start = typeof variables.after === 'string' ? Number(variables.after.replace(/^c/, '')) : 0;
  const nodes = items.slice(start, start + first);
  const end = start + nodes.length;
  return { nodes, pageInfo: pageInfo(end < items.length, end < items.length ? `c${end}` : null) };
}

const user = { id: 'user-1', name: 'Ada Lovelace', displayName: 'Ada', email: 'ada@example.com', avatarUrl: null };

/** A workspace with one team (`ENG`), one project and one open issue (`ENG-42`) in that project. */
export function linearWorkspace(id = 'workspace-1', overrides: Partial<FakeLinearWorkspace> = {}): FakeLinearWorkspace {
  const team = { id: 'team-1', key: 'ENG', name: 'Engineering' };
  return {
    id,
    name: 'Acme',
    urlKey: 'acme',
    appUserId: `app-user-${id}`,
    projects: [{ id: 'project-1', name: 'Platform', state: 'started', teams: [team] }],
    teams: [team],
    issues: [linearIssue()],
    comments: {},
    states: {
      'team-1': [
        { id: 'state-todo', name: 'Todo', type: 'unstarted', position: 1 },
        { id: 'state-done', name: 'Done', type: 'completed', position: 3 },
      ],
    },
    ...overrides,
  };
}

export function linearIssue(overrides: Partial<LinearGraphqlIssue> = {}): LinearGraphqlIssue {
  return {
    id: 'issue-1',
    identifier: 'ENG-42',
    number: 42,
    title: 'Fix intake',
    description: 'Issue body',
    url: 'https://linear.app/acme/issue/ENG-42',
    priority: 2,
    priorityLabel: 'High',
    labels: [{ id: 'label-1', name: 'bug' }],
    state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
    team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
    project: { id: 'project-1' },
    assignee: user,
    creator: user,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
    archivedAt: null,
    ...overrides,
  };
}

export function linearComment(
  issue: LinearGraphqlIssue,
  overrides: Partial<LinearGraphqlComment> = {},
): LinearGraphqlComment {
  return {
    id: 'comment-1',
    body: 'Looking now',
    url: `${issue.url}#comment-comment-1`,
    issue: { id: issue.id, identifier: issue.identifier },
    user,
    parent: null,
    createdAt: '2026-07-03T00:00:00Z',
    updatedAt: '2026-07-03T00:00:00Z',
    ...overrides,
  };
}

/** Starts a fake platform serving Linear through Connect. */
export async function startFakeLinear(): Promise<FakeLinear> {
  return new FakeLinear(await startFakePlatform());
}
