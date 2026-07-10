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
  url.searchParams.set('scope', 'read');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

/** Exchange an OAuth `code` for a workspace-scoped access token. */
export async function exchangeLinearOAuthCode(code: string, redirectUri: string): Promise<string> {
  const config = requireConfig();
  const res = await fetch(LINEAR_TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Linear token exchange failed (${res.status})`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('Linear token exchange returned no access token.');
  }
  return body.access_token;
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
    const err = new Error(`Linear API request failed (${res.status})`);
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
