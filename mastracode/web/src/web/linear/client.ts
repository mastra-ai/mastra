/**
 * Linear OAuth + GraphQL client helpers.
 *
 * Builds the user-facing OAuth authorize URL, exchanges the callback `code`
 * for a workspace-scoped access token, and reads from Linear's GraphQL API
 * (viewer/workspace identity and the active-issue list for Intake).
 *
 * The feature is enabled only when the Linear OAuth env vars are present. The
 * server additionally requires web auth to be on (a per-org connection needs a
 * logged-in user); that combined check lives in `./config`.
 */

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_AUTHORIZE_URL = 'https://linear.app/oauth/authorize';

/** Required Linear OAuth env var names (non-secret names only). */
const LINEAR_ENV_VARS = ['LINEAR_CLIENT_ID', 'LINEAR_CLIENT_SECRET'] as const;

/**
 * Names of required Linear env vars that are not set. Exposed so logs and
 * status diagnostics can say *which* gate is missing instead of only
 * `enabled:false`. Only env var *names* are returned — never values.
 */
export function getMissingLinearEnvVars(): string[] {
  return LINEAR_ENV_VARS.filter(name => !process.env[name]);
}

/** True when all Linear OAuth env vars are present. */
export function isLinearAppConfigured(): boolean {
  return getMissingLinearEnvVars().length === 0;
}

interface LinearOAuthConfig {
  clientId: string;
  clientSecret: string;
}

function requireConfig(): LinearOAuthConfig {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Linear OAuth is not configured (missing LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET).');
  }
  return { clientId, clientSecret };
}

/**
 * Build the OAuth authorize URL. `prompt=consent` forces the workspace picker
 * even for an already-authorized user, so "reconnect" can switch workspaces.
 */
export function buildLinearAuthorizeUrl(state: string, redirectUri: string): string {
  const config = requireConfig();
  const url = new URL(LINEAR_AUTHORIZE_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // `comments:create` lets the agent's linear_create_comment tool post
  // comments; everything else the integration does is read-only.
  url.searchParams.set('scope', 'read,comments:create');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

/**
 * Tokens minted by Linear's `/oauth/token` endpoint. Linear access tokens
 * expire (24h) and refresh tokens rotate: every refresh invalidates the old
 * pair, so callers must persist the whole set after each exchange.
 */
export interface LinearTokenSet {
  accessToken: string;
  /** Null when Linear issued no refresh token (legacy non-expiring apps). */
  refreshToken: string | null;
  /** Null when Linear reported no `expires_in`. */
  expiresAt: Date | null;
  /** Scopes granted to the token as reported by Linear; null when omitted. */
  scope: string | null;
}

/** POST to Linear's token endpoint and normalize the response. */
async function requestLinearTokens(params: Record<string, string>, label: string): Promise<LinearTokenSet> {
  const config = requireConfig();
  const res = await fetch(LINEAR_TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...params,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  if (!res.ok) {
    const err = new Error(`Linear ${label} failed (${res.status})`);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!body.access_token) {
    throw new Error(`Linear ${label} returned no access token.`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: typeof body.expires_in === 'number' ? new Date(Date.now() + body.expires_in * 1000) : null,
    scope: body.scope ?? null,
  };
}

/** Exchange an OAuth `code` for a workspace-scoped token set. */
export async function exchangeLinearOAuthCode(code: string, redirectUri: string): Promise<LinearTokenSet> {
  return requestLinearTokens({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }, 'token exchange');
}

/**
 * Exchange a refresh token for a new token set. Linear rotates refresh tokens,
 * so the returned set replaces the stored one entirely. A 400/401 here means
 * the refresh token is invalid/revoked and the org must re-authorize.
 */
export async function refreshLinearAccessToken(refreshToken: string): Promise<LinearTokenSet> {
  return requestLinearTokens({ grant_type: 'refresh_token', refresh_token: refreshToken }, 'token refresh');
}

/** POST a GraphQL query to Linear with the given OAuth access token. */
async function linearGraphql<T>(accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    // Linear returns GraphQL errors (validation, missing scopes, …) with a
    // 400 status — surface the actual message instead of just the code.
    let detail: string | null = null;
    try {
      const errBody = (await res.json()) as { errors?: Array<{ message?: string }> };
      detail = errBody.errors?.[0]?.message ?? null;
    } catch {
      // Non-JSON error body; fall back to the status code alone.
    }
    const err = new Error(`Linear API request failed (${res.status})${detail ? `: ${detail}` : ''}`);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  const body = (await res.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (body.errors?.length) {
    throw new Error(`Linear API error: ${body.errors[0]?.message ?? 'unknown error'}`);
  }
  if (!body.data) {
    throw new Error('Linear API returned no data.');
  }
  return body.data;
}

export interface LinearWorkspace {
  name: string;
  urlKey: string;
}

/** Fetch the workspace (organization) the access token is scoped to. */
export async function fetchLinearWorkspace(accessToken: string): Promise<LinearWorkspace> {
  const data = await linearGraphql<{ organization: { name: string; urlKey: string } }>(
    accessToken,
    `query { organization { name urlKey } }`,
  );
  return { name: data.organization.name, urlKey: data.organization.urlKey };
}

export interface LinearIssue {
  id: string;
  /** Human key like `ENG-123`. */
  identifier: string;
  title: string;
  url: string;
  /** Workflow state name, e.g. `In Progress`. */
  state: string;
  /** Workflow state type, e.g. `backlog` / `unstarted` / `started` / `triage`. */
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  team: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LinearIssuePage {
  issues: LinearIssue[];
  /** Opaque cursor for the next page, or `null` on the last page. */
  nextCursor: string | null;
}

export interface LinearProjectTeam {
  id: string;
  /** Short team key, e.g. `ENG`. */
  key: string;
  name: string;
}

export interface LinearProject {
  id: string;
  name: string;
  /** Project state, e.g. `planned` / `started` / `paused` / `completed`. */
  state: string;
  /** Teams the project belongs to (the Settings picker groups by these). */
  teams: LinearProjectTeam[];
}

/** List the workspace's projects (for the Settings intake-source picker). */
export async function listLinearProjects(accessToken: string): Promise<LinearProject[]> {
  const data = await linearGraphql<{
    projects: {
      nodes: Array<{
        id: string;
        name: string;
        state: string;
        teams: { nodes: Array<{ id: string; key: string; name: string }> };
      }>;
    };
  }>(
    accessToken,
    `query { projects(first: 100) { nodes { id name state teams(first: 10) { nodes { id key name } } } } }`,
  );
  return data.projects.nodes.map(node => ({
    id: node.id,
    name: node.name,
    state: node.state,
    teams: node.teams.nodes.map(team => ({ id: team.id, key: team.key, name: team.name })),
  }));
}

const LINEAR_ISSUES_PAGE_SIZE = 30;

interface IssuesQueryData {
  issues: {
    nodes: Array<{
      id: string;
      identifier: string;
      title: string;
      url: string;
      priorityLabel: string;
      createdAt: string;
      updatedAt: string;
      state: { name: string; type: string };
      assignee: { name: string } | null;
      team: { key: string } | null;
      labels: { nodes: Array<{ name: string }> };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

/**
 * List one page of the workspace's active issues (triage/backlog/unstarted/
 * started — completed and canceled are excluded), most recently updated first.
 * When `projectIds` is provided, only issues from those projects are returned.
 */
export async function listActiveLinearIssues(
  accessToken: string,
  after?: string,
  projectIds?: string[],
): Promise<LinearIssuePage> {
  const projectFilter = projectIds?.length ? ', project: { id: { in: $projectIds } }' : '';
  const projectVar = projectIds?.length ? ', $projectIds: [ID!]' : '';
  const data = await linearGraphql<IssuesQueryData>(
    accessToken,
    `query Intake($first: Int!, $after: String${projectVar}) {
      issues(
        first: $first
        after: $after
        orderBy: updatedAt
        filter: { state: { type: { in: ["triage", "backlog", "unstarted", "started"] } }${projectFilter} }
      ) {
        nodes {
          id
          identifier
          title
          url
          priorityLabel
          createdAt
          updatedAt
          state { name type }
          assignee { name }
          team { key }
          labels { nodes { name } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: LINEAR_ISSUES_PAGE_SIZE,
      after: after ?? null,
      ...(projectIds?.length ? { projectIds } : {}),
    },
  );
  const { nodes, pageInfo } = data.issues;
  return {
    issues: nodes.map(node => ({
      id: node.id,
      identifier: node.identifier,
      title: node.title,
      url: node.url,
      state: node.state.name,
      stateType: node.state.type,
      priorityLabel: node.priorityLabel,
      assignee: node.assignee?.name ?? null,
      team: node.team?.key ?? null,
      labels: node.labels.nodes.map(label => label.name),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    })),
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  };
}

export interface LinearIssueComment {
  author: string | null;
  body: string;
  createdAt: string;
}

/** Full issue payload for agent context: everything in {@link LinearIssue} plus description and discussion. */
export interface LinearIssueDetail extends LinearIssue {
  /** Markdown body of the issue, or `null` when empty. */
  description: string | null;
  /** Discussion comments, oldest first. */
  comments: LinearIssueComment[];
}

const ISSUE_COMMENTS_PAGE_SIZE = 50;

interface IssueDetailQueryData {
  issue: {
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    url: string;
    priorityLabel: string;
    createdAt: string;
    updatedAt: string;
    state: { name: string; type: string };
    assignee: { name: string } | null;
    team: { key: string } | null;
    labels: { nodes: Array<{ name: string }> };
    comments: { nodes: Array<{ body: string; createdAt: string; user: { name: string } | null }> };
  } | null;
}

/**
 * Fetch one issue with its description and comments. `idOrIdentifier` accepts
 * both the Linear UUID and the human key (`ENG-123`). Returns `null` when the
 * issue doesn't exist (Linear reports it as an "Entity not found" error).
 */
export async function fetchLinearIssueDetail(
  accessToken: string,
  idOrIdentifier: string,
): Promise<LinearIssueDetail | null> {
  let data: IssueDetailQueryData;
  try {
    data = await linearGraphql<IssueDetailQueryData>(
      accessToken,
      `query IssueDetail($id: String!, $commentsFirst: Int!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          url
          priorityLabel
          createdAt
          updatedAt
          state { name type }
          assignee { name }
          team { key }
          labels { nodes { name } }
          comments(first: $commentsFirst) { nodes { body createdAt user { name } } }
        }
      }`,
      { id: idOrIdentifier, commentsFirst: ISSUE_COMMENTS_PAGE_SIZE },
    );
  } catch (err) {
    // Linear surfaces unknown ids/identifiers as a GraphQL "Entity not found"
    // error rather than a null node — map that to "issue doesn't exist".
    if (err instanceof Error && /entity not found/i.test(err.message)) return null;
    throw err;
  }
  const issue = data.issue;
  if (!issue) return null;
  const comments = [...issue.comments.nodes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description?.trim() ? issue.description : null,
    url: issue.url,
    state: issue.state.name,
    stateType: issue.state.type,
    priorityLabel: issue.priorityLabel,
    assignee: issue.assignee?.name ?? null,
    team: issue.team?.key ?? null,
    labels: issue.labels.nodes.map(label => label.name),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    comments: comments.map(comment => ({
      author: comment.user?.name ?? null,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  };
}

/** The comment created by {@link createLinearIssueComment}. */
export interface LinearCreatedComment {
  id: string;
  url: string;
}

interface IssueIdQueryData {
  issue: { id: string } | null;
}

interface CommentCreateMutationData {
  commentCreate: { success: boolean; comment: { id: string; url: string } | null };
}

/**
 * Post a comment on an issue. `idOrIdentifier` accepts both the Linear UUID
 * and the human key (`ENG-123`) — the identifier is resolved to a UUID first
 * because `commentCreate` only accepts UUIDs. Returns `null` when the issue
 * doesn't exist.
 */
export async function createLinearIssueComment(
  accessToken: string,
  idOrIdentifier: string,
  body: string,
): Promise<LinearCreatedComment | null> {
  let issueId: string;
  try {
    const data = await linearGraphql<IssueIdQueryData>(
      accessToken,
      `query IssueId($id: String!) { issue(id: $id) { id } }`,
      { id: idOrIdentifier },
    );
    if (!data.issue) return null;
    issueId = data.issue.id;
  } catch (err) {
    if (err instanceof Error && /entity not found/i.test(err.message)) return null;
    throw err;
  }
  const data = await linearGraphql<CommentCreateMutationData>(
    accessToken,
    `mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) { success comment { id url } }
    }`,
    { input: { issueId, body } },
  );
  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error('Linear did not accept the comment.');
  }
  return data.commentCreate.comment;
}
