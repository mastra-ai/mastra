/**
 * Linear GraphQL operations shared by the direct `LinearIntegration` and the
 * Connect-backed `PlatformLinearIntegration`. Each operation takes a
 * {@link LinearGraphqlTransport}, so the same query text and response mapping
 * run whether the request goes straight to Linear with a user token or through
 * the Mastra Connect proxy.
 */

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

/** Sends one GraphQL request and resolves to the response body (`{ data, errors }`). */
export type LinearGraphqlTransport = (query: string, variables: Record<string, unknown>) => Promise<unknown>;

export type LinearPageInfo = { hasNextPage: boolean; endCursor: string | null };
export type LinearPage<T> = { nodes: T[]; pageInfo: LinearPageInfo };

export type LinearUser = {
  id: string;
  name: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};

export type LinearGraphqlIssue = {
  id: string;
  identifier: string;
  number: number;
  title: string;
  description: string | null;
  url: string;
  priority: number;
  priorityLabel: string;
  labels: Array<{ id: string; name: string }>;
  state: { id: string; name: string; type: string };
  team: { id: string; key: string; name: string };
  project: { id: string } | null;
  assignee: LinearUser | null;
  creator: LinearUser | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type LinearGraphqlComment = {
  id: string;
  body: string;
  url: string;
  issue: { id: string; identifier: string };
  user: LinearUser | null;
  parent: { id: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type LinearGraphqlIssueWithComments = LinearGraphqlIssue & { comments: LinearPage<LinearGraphqlComment> };

export type LinearGraphqlProject = {
  id: string;
  name: string;
  state: string;
  teams: Array<{ id: string; key: string; name: string }>;
};

export type LinearGraphqlTeam = { id: string; key: string; name: string };

export type LinearGraphqlWorkflowState = {
  id: string;
  name: string;
  type: string;
  position: number;
  teamId: string;
};

/** The token's app user and the Linear workspace (organization) it belongs to. */
export type LinearViewer = {
  appUserId: string;
  workspace: { id: string; name: string; urlKey: string };
};

/** The workflow state types Factory treats as open work. */
export const ACTIVE_ISSUE_STATE_TYPES = ['triage', 'backlog', 'unstarted', 'started'] as const;

const USER_FIELDS = 'id name displayName email avatarUrl';
const ISSUE_FIELDS = `
  id
  identifier
  number
  title
  description
  url
  priority
  priorityLabel
  labels { nodes { id name } }
  state { id name type }
  team { id key name }
  project { id }
  assignee { ${USER_FIELDS} }
  creator { ${USER_FIELDS} }
  createdAt
  updatedAt
  archivedAt`;
const COMMENT_FIELDS = `
  id
  body
  url
  issue { id identifier }
  user { ${USER_FIELDS} }
  parent { id }
  createdAt
  updatedAt`;
const PAGE_INFO = 'pageInfo { hasNextPage endCursor }';

/** A Linear API failure: an HTTP error or a GraphQL `errors[]` entry. */
export class LinearGraphqlError extends Error {
  /** HTTP status, when the request itself failed. */
  readonly status?: number;
  /** `errors[0].extensions.code`, e.g. `RATELIMITED` or `ENTITY_NOT_FOUND`. */
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(message: string, details: { status?: number; code?: string; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'LinearGraphqlError';
    if (details.status !== undefined) this.status = details.status;
    if (details.code !== undefined) this.code = details.code;
    if (details.retryAfterSeconds !== undefined) this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

/** Linear reports unknown ids and identifiers as an "Entity not found" error rather than a null node. */
export function isLinearNotFound(error: unknown): boolean {
  if (error instanceof LinearGraphqlError && error.code === 'ENTITY_NOT_FOUND') return true;
  return error instanceof Error && /entity not found/i.test(error.message);
}

export function isLinearRateLimited(error: unknown): boolean {
  return error instanceof LinearGraphqlError && (error.status === 429 || error.code === 'RATELIMITED');
}

export function invalidLinearCursor(): Error {
  return Object.assign(new Error('Linear cursor is invalid or stale.'), { code: 'invalid_cursor' as const });
}

type GraphqlErrorEntry = { message?: string; extensions?: { code?: unknown } };

function errorCode(errors: GraphqlErrorEntry[] | undefined): string | undefined {
  const code = errors?.[0]?.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}

/** A transport that POSTs straight to Linear with an OAuth access token. */
export function linearHttpTransport(accessToken: string): LinearGraphqlTransport {
  return linearFetchTransport({ url: LINEAR_GRAPHQL_URL, headers: { authorization: `Bearer ${accessToken}` } });
}

/**
 * A transport that POSTs to a Linear GraphQL endpoint with `fetch`: Linear
 * itself, or a proxy that passes Linear's responses through unchanged.
 */
export function linearFetchTransport(options: {
  url: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}): LinearGraphqlTransport {
  return async (query, variables) => {
    const send = options.fetch ?? fetch;
    const res = await send(options.url, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      // Linear returns GraphQL errors (validation, missing scopes, …) with a
      // 400 status — surface the actual message instead of just the code.
      let errors: GraphqlErrorEntry[] | undefined;
      try {
        errors = ((await res.json()) as { errors?: GraphqlErrorEntry[] }).errors;
      } catch {
        // Non-JSON error body; fall back to the status code alone.
      }
      const detail = errors?.[0]?.message ?? null;
      const retryAfter = Number(res.headers.get('retry-after'));
      throw new LinearGraphqlError(`Linear API request failed (${res.status})${detail ? `: ${detail}` : ''}`, {
        status: res.status,
        code: errorCode(errors),
        ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
      });
    }
    return res.json();
  };
}

async function run<T>(transport: LinearGraphqlTransport, query: string, variables: Record<string, unknown> = {}) {
  const body = (await transport(query, variables)) as { data?: T; errors?: GraphqlErrorEntry[] } | null;
  if (body?.errors?.length) {
    throw new LinearGraphqlError(`Linear API error: ${body.errors[0]?.message ?? 'unknown error'}`, {
      code: errorCode(body.errors),
    });
  }
  if (!body?.data) throw new Error('Linear API returned no data.');
  return body.data;
}

type IssueNode = Omit<LinearGraphqlIssue, 'labels'> & { labels: { nodes: Array<{ id: string; name: string }> } };

function toIssue(node: IssueNode): LinearGraphqlIssue {
  return {
    ...node,
    labels: node.labels.nodes.map(label => ({ id: label.id, name: label.name })),
    project: node.project ?? null,
    assignee: node.assignee ?? null,
    creator: node.creator ?? null,
  };
}

function toComment(node: LinearGraphqlComment): LinearGraphqlComment {
  return { ...node, user: node.user ?? null, parent: node.parent ?? null };
}

function toCommentPage(page: LinearPage<LinearGraphqlComment>): LinearPage<LinearGraphqlComment> {
  return { nodes: page.nodes.map(toComment), pageInfo: page.pageInfo };
}

/** Follow `pageInfo` until the last page, stopping at `maxPages` and on a cursor that repeats. */
async function collectPages<T>(
  maxPages: number,
  fetchPage: (after: string | undefined) => Promise<LinearPage<T>>,
): Promise<T[]> {
  const nodes: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage(after);
    nodes.push(...result.nodes);
    if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
    // A page that hands back the cursor it was asked for would replay forever.
    if (result.pageInfo.endCursor === after) throw invalidLinearCursor();
    after = result.pageInfo.endCursor;
  }
  return nodes;
}

export async function getViewer(transport: LinearGraphqlTransport): Promise<LinearViewer> {
  const data = await run<{ viewer: { id: string; organization: { id: string; name: string; urlKey: string } } }>(
    transport,
    `query Viewer { viewer { id organization { id name urlKey } } }`,
  );
  const { organization } = data.viewer;
  return {
    appUserId: data.viewer.id,
    workspace: { id: organization.id, name: organization.name, urlKey: organization.urlKey },
  };
}

export async function listProjects(
  transport: LinearGraphqlTransport,
  input: { first: number; after?: string },
): Promise<LinearPage<LinearGraphqlProject>> {
  type ProjectNode = Omit<LinearGraphqlProject, 'teams'> & { teams: { nodes: LinearGraphqlProject['teams'] } };
  const data = await run<{ projects: LinearPage<ProjectNode> }>(
    transport,
    `query Projects($first: Int!, $after: String) {
      projects(first: $first, after: $after) {
        nodes { id name state teams(first: 25) { nodes { id key name } } }
        ${PAGE_INFO}
      }
    }`,
    { first: input.first, ...(input.after ? { after: input.after } : {}) },
  );
  return {
    nodes: data.projects.nodes.map(node => ({
      id: node.id,
      name: node.name,
      state: node.state,
      teams: node.teams.nodes.map(team => ({ id: team.id, key: team.key, name: team.name })),
    })),
    pageInfo: data.projects.pageInfo,
  };
}

export function listAllProjects(
  transport: LinearGraphqlTransport,
  input: { pageSize: number; maxPages: number },
): Promise<LinearGraphqlProject[]> {
  return collectPages(input.maxPages, after => listProjects(transport, { first: input.pageSize, after }));
}

export async function listTeams(
  transport: LinearGraphqlTransport,
  input: { first: number; after?: string },
): Promise<LinearPage<LinearGraphqlTeam>> {
  const data = await run<{ teams: LinearPage<LinearGraphqlTeam> }>(
    transport,
    `query Teams($first: Int!, $after: String) {
      teams(first: $first, after: $after) {
        nodes { id key name }
        ${PAGE_INFO}
      }
    }`,
    { first: input.first, ...(input.after ? { after: input.after } : {}) },
  );
  return {
    nodes: data.teams.nodes.map(team => ({ id: team.id, key: team.key, name: team.name })),
    pageInfo: data.teams.pageInfo,
  };
}

export function listAllTeams(
  transport: LinearGraphqlTransport,
  input: { pageSize: number; maxPages: number },
): Promise<LinearGraphqlTeam[]> {
  return collectPages(input.maxPages, after => listTeams(transport, { first: input.pageSize, after }));
}

/**
 * One page of issues, most recently updated first. `projectIds`, `teamIds` and
 * `labels` each narrow the result and are AND-ed together, so callers list
 * project and team sources in separate calls.
 */
export async function listIssues(
  transport: LinearGraphqlTransport,
  input: {
    first: number;
    after?: string;
    stateTypes?: readonly string[];
    projectIds?: readonly string[];
    teamIds?: readonly string[];
    labels?: readonly string[];
  },
): Promise<LinearPage<LinearGraphqlIssue>> {
  const stateTypes = input.stateTypes ?? ACTIVE_ISSUE_STATE_TYPES;
  const projectIds = input.projectIds?.length ? [...input.projectIds] : null;
  const teamIds = input.teamIds?.length ? [...input.teamIds] : null;
  const labels = input.labels?.length ? [...input.labels] : null;
  const vars = `$first: Int!, $after: String, $stateTypes: [String!]${projectIds ? ', $projectIds: [ID!]' : ''}${
    teamIds ? ', $teamIds: [ID!]' : ''
  }${labels ? ', $labels: [String!]' : ''}`;
  const filter = `state: { type: { in: $stateTypes } }${projectIds ? ', project: { id: { in: $projectIds } }' : ''}${
    teamIds ? ', team: { id: { in: $teamIds } }' : ''
  }${labels ? ', labels: { name: { in: $labels } }' : ''}`;
  const data = await run<{ issues: LinearPage<IssueNode> }>(
    transport,
    `query Intake(${vars}) {
      issues(first: $first, after: $after, orderBy: updatedAt, filter: { ${filter} }) {
        nodes { ${ISSUE_FIELDS} }
        ${PAGE_INFO}
      }
    }`,
    {
      first: input.first,
      after: input.after ?? null,
      stateTypes: [...stateTypes],
      ...(projectIds ? { projectIds } : {}),
      ...(teamIds ? { teamIds } : {}),
      ...(labels ? { labels } : {}),
    },
  );
  const { nodes, pageInfo } = data.issues;
  if (pageInfo.hasNextPage && input.after && pageInfo.endCursor === input.after) throw invalidLinearCursor();
  return { nodes: nodes.map(toIssue), pageInfo };
}

/**
 * One issue with its first page of comments. `idOrIdentifier` accepts both the
 * Linear UUID and the human key (`ENG-123`). Resolves to `null` when the issue
 * doesn't exist.
 */
export async function getIssue(
  transport: LinearGraphqlTransport,
  idOrIdentifier: string,
  input: { commentsFirst: number },
): Promise<LinearGraphqlIssueWithComments | null> {
  let data: { issue: (IssueNode & { comments: LinearPage<LinearGraphqlComment> }) | null };
  try {
    data = await run(
      transport,
      `query IssueDetail($id: String!, $commentsFirst: Int!) {
        issue(id: $id) {
          ${ISSUE_FIELDS}
          comments(first: $commentsFirst) { nodes { ${COMMENT_FIELDS} } ${PAGE_INFO} }
        }
      }`,
      { id: idOrIdentifier, commentsFirst: input.commentsFirst },
    );
  } catch (error) {
    if (isLinearNotFound(error)) return null;
    throw error;
  }
  if (!data.issue) return null;
  return { ...toIssue(data.issue), comments: toCommentPage(data.issue.comments) };
}

/** One page of an issue's comments; `null` when the issue doesn't exist. */
export async function listIssueComments(
  transport: LinearGraphqlTransport,
  idOrIdentifier: string,
  input: { first: number; after: string },
): Promise<LinearPage<LinearGraphqlComment> | null> {
  const data = await run<{ issue: { comments: LinearPage<LinearGraphqlComment> } | null }>(
    transport,
    `query IssueComments($id: String!, $first: Int!, $after: String!) {
      issue(id: $id) {
        comments(first: $first, after: $after) { nodes { ${COMMENT_FIELDS} } ${PAGE_INFO} }
      }
    }`,
    { id: idOrIdentifier, first: input.first, after: input.after },
  );
  return data.issue ? toCommentPage(data.issue.comments) : null;
}

/** Every comment of an issue, following `firstPage` until the last page or `maxPages` pages in total. */
export async function collectIssueComments(
  transport: LinearGraphqlTransport,
  idOrIdentifier: string,
  firstPage: LinearPage<LinearGraphqlComment>,
  input: { pageSize: number; maxPages: number },
): Promise<LinearGraphqlComment[]> {
  const nodes = [...firstPage.nodes];
  let { hasNextPage, endCursor } = firstPage.pageInfo;
  for (let page = 1; hasNextPage && endCursor && page < input.maxPages; page++) {
    const comments = await listIssueComments(transport, idOrIdentifier, { first: input.pageSize, after: endCursor });
    if (!comments) break;
    nodes.push(...comments.nodes);
    if (comments.pageInfo.hasNextPage && comments.pageInfo.endCursor === endCursor) throw invalidLinearCursor();
    ({ hasNextPage, endCursor } = comments.pageInfo);
  }
  return nodes;
}

/** Resolve an identifier (`ENG-123`) or UUID to the issue's UUID; `null` when it doesn't exist. */
export async function resolveIssueId(
  transport: LinearGraphqlTransport,
  idOrIdentifier: string,
): Promise<string | null> {
  try {
    const data = await run<{ issue: { id: string } | null }>(
      transport,
      `query IssueId($id: String!) { issue(id: $id) { id } }`,
      { id: idOrIdentifier },
    );
    return data.issue?.id ?? null;
  } catch (error) {
    if (isLinearNotFound(error)) return null;
    throw error;
  }
}

/** Post a comment. `issueId` must be the UUID: `commentCreate` doesn't accept identifiers. */
export async function createComment(
  transport: LinearGraphqlTransport,
  input: { issueId: string; body: string },
): Promise<LinearGraphqlComment> {
  const data = await run<{ commentCreate: { success: boolean; comment: LinearGraphqlComment | null } }>(
    transport,
    `mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) { success comment { ${COMMENT_FIELDS} } }
    }`,
    { input: { issueId: input.issueId, body: input.body } },
  );
  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error('Linear did not accept the comment.');
  }
  return toComment(data.commentCreate.comment);
}

/** Move an issue to a workflow state. `issueId` must be the UUID. */
export async function updateIssueState(
  transport: LinearGraphqlTransport,
  input: { issueId: string; stateId: string },
): Promise<void> {
  const data = await run<{ issueUpdate: { success: boolean } }>(
    transport,
    `mutation UpdateIssueState($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }`,
    { id: input.issueId, stateId: input.stateId },
  );
  if (!data.issueUpdate.success) throw new Error('Linear did not accept the issue update.');
}

/** A team's workflow states. `teamId` accepts the team's UUID or key. Empty when the team doesn't exist. */
export async function listWorkflowStates(
  transport: LinearGraphqlTransport,
  teamId: string,
): Promise<LinearGraphqlWorkflowState[]> {
  const data = await run<{
    team: { id?: string; states: { nodes: Array<Omit<LinearGraphqlWorkflowState, 'teamId'>> } } | null;
  }>(
    transport,
    `query TeamStates($teamId: String!) {
      team(id: $teamId) { id states(first: 100) { nodes { id name type position } } }
    }`,
    { teamId },
  );
  if (!data.team) return [];
  const resolvedTeamId = data.team.id ?? teamId;
  return data.team.states.nodes.map(state => ({
    id: state.id,
    name: state.name,
    type: state.type,
    position: state.position,
    teamId: resolvedTeamId,
  }));
}
