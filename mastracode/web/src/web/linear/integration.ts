/**
 * `LinearIntegration` — the self-contained Linear integration.
 *
 * Implements the system-wide `FactoryIntegration` contract
 * (`../factory-integration.ts`): the deploy entry reads the Linear OAuth env
 * vars ONCE, constructs an instance with explicit credentials, and passes it
 * to `MastraFactory`. Everything Linear-flavored the system does — the OAuth
 * connect/callback flow, workspace/project/issue reads for Intake, and the
 * agent's issue tools — flows through this instance. No other module reads
 * `LINEAR_*` env vars.
 *
 * The class owns:
 *  - OAuth: the user-facing authorize URL, code exchange, and refresh-token
 *    rotation against Linear's `/oauth/token` endpoint.
 *  - GraphQL reads/writes: viewer workspace, projects, active issues for
 *    Intake, full issue detail (description + discussion), issue comments.
 *  - The HTTP surface (`routes()`) and per-request agent tools
 *    (`agentTools()`), delegating to `./routes.ts` / `./agent-tools.ts` with
 *    `this` as the API client.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import type { IntegrationConnection } from '../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  ListIntakeIssuesInput,
} from '../capabilities/intake.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../factory-integration.js';
import { buildLinearAgentTools } from './agent-tools.js';
import { getFreshLinearAccessToken, loadLinearConnection } from './connection.js';
import { buildLinearRoutes } from './routes.js';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_AUTHORIZE_URL = 'https://linear.app/oauth/authorize';

/** Credentials for the Linear OAuth application. All fields are required. */
export interface LinearIntegrationConfig {
  /** OAuth client id of the Linear application. */
  clientId: string;
  /** OAuth client secret of the Linear application. */
  clientSecret: string;
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

export interface LinearWorkspace {
  name: string;
  urlKey: string;
}

export interface LinearIssue {
  id: string;
  projectId: string;
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

/** The comment created by {@link LinearIntegration.createIssueComment}. */
export interface LinearCreatedComment {
  id: string;
  url: string;
}

const LINEAR_ISSUES_PAGE_SIZE = 30;
const ISSUE_COMMENTS_PAGE_SIZE = 50;
/** Hard stop for comment pagination so a misbehaving cursor can't loop forever. */
const ISSUE_COMMENTS_MAX_PAGES = 20;

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
      project: { id: string };
      assignee: { name: string } | null;
      team: { key: string } | null;
      labels: { nodes: Array<{ name: string }> };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface IssueCommentNode {
  body: string;
  createdAt: string;
  user: { name: string } | null;
}

interface IssueCommentsPage {
  nodes: IssueCommentNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

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
    project: { id: string };
    assignee: { name: string } | null;
    team: { key: string } | null;
    labels: { nodes: Array<{ name: string }> };
    comments: IssueCommentsPage;
  } | null;
}

interface IssueCommentsQueryData {
  issue: { comments: IssueCommentsPage } | null;
}

interface IssueIdQueryData {
  issue: { id: string } | null;
}

interface CommentCreateMutationData {
  commentCreate: { success: boolean; comment: { id: string; url: string } | null };
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

export class LinearIntegration implements FactoryIntegration {
  /** Stable integration identifier (see `../factory-integration.ts`). */
  readonly id = 'linear';
  readonly intake: Intake = {
    listSources: async ({ orgId }) => {
      const connection = await loadLinearConnection(orgId);
      if (!connection) return [];
      const accessToken = await getFreshLinearAccessToken(this, connection);
      const projects = await this.listProjects(accessToken);
      return projects.map(project => ({
        id: project.id,
        name: project.name,
        type: 'project',
      }));
    },
    listItems: async ({ orgId, sourceIds, cursor }) => {
      if (sourceIds.length === 0) return { items: [], nextCursor: null };
      const connection = await loadLinearConnection(orgId);
      if (!connection) return { items: [], nextCursor: null };
      const accessToken = await getFreshLinearAccessToken(this, connection);
      const page = await this.listActiveIssues(accessToken, cursor, sourceIds);
      return {
        items: page.issues.map(issue => ({
          source: { type: 'issue', externalId: issue.id, url: issue.url },
          sourceId: issue.projectId,
          title: `${issue.identifier}: ${issue.title}`,
          status: issue.state,
          labels: issue.labels,
          assignee: issue.assignee,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          metadata: {
            identifier: issue.identifier,
            stateType: issue.stateType,
            priority: issue.priorityLabel,
            team: issue.team,
          },
        })),
        nextCursor: page.nextCursor,
      };
    },
    listIssues: input => this.#listIntakeIssues(input),
    getIssue: input => this.#getIntakeIssue(input),
    createComment: input => this.#createIntakeComment(input),
  };
  /**
   * The OAuth connect/callback flow round-trips a signed `state` through
   * Linear, so a multi-replica deploy needs a deployment-stable state secret.
   */
  readonly requiresStableStateSigner = true;

  readonly #clientId: string;
  readonly #clientSecret: string;

  constructor(config: LinearIntegrationConfig) {
    const missing = (['clientId', 'clientSecret'] as const).filter(key => !config[key]);
    if (missing.length > 0) {
      throw new Error(`LinearIntegration is missing required config: ${missing.join(', ')}.`);
    }
    this.#clientId = config.clientId;
    this.#clientSecret = config.clientSecret;
  }

  // ── OAuth ────────────────────────────────────────────────────────────────

  /**
   * Build the OAuth authorize URL. `prompt=consent` forces the workspace
   * picker even for an already-authorized user, so "reconnect" can switch
   * workspaces.
   */
  buildAuthorizeUrl(state: string, redirectUri: string): string {
    const url = new URL(LINEAR_AUTHORIZE_URL);
    url.searchParams.set('client_id', this.#clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    // `comments:create` lets the agent's linear_create_comment tool post
    // comments; everything else the integration does is read-only.
    url.searchParams.set('scope', 'read,comments:create');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  /** Exchange an OAuth `code` for a workspace-scoped token set. */
  async exchangeOAuthCode(code: string, redirectUri: string): Promise<LinearTokenSet> {
    return this.#requestTokens({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }, 'token exchange');
  }

  /**
   * Exchange a refresh token for a new token set. Linear rotates refresh
   * tokens, so the returned set replaces the stored one entirely. A 400/401
   * here means the refresh token is invalid/revoked and the org must
   * re-authorize.
   */
  async refreshAccessToken(refreshToken: string): Promise<LinearTokenSet> {
    return this.#requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken }, 'token refresh');
  }

  /** POST to Linear's token endpoint and normalize the response. */
  async #requestTokens(params: Record<string, string>, label: string): Promise<LinearTokenSet> {
    const res = await fetch(LINEAR_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: this.#clientId,
        client_secret: this.#clientSecret,
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

  // ── GraphQL reads/writes ─────────────────────────────────────────────────

  /** Fetch the workspace (organization) the access token is scoped to. */
  async fetchWorkspace(accessToken: string): Promise<LinearWorkspace> {
    const data = await linearGraphql<{ organization: { name: string; urlKey: string } }>(
      accessToken,
      `query { organization { name urlKey } }`,
    );
    return { name: data.organization.name, urlKey: data.organization.urlKey };
  }

  async #listIntakeIssues(input: ListIntakeIssuesInput): Promise<{ issues: IntakeIssue[]; nextCursor: string | null }> {
    const accessToken = getLinearAccessToken(input.connection);
    const result = await this.listActiveIssues(accessToken, input.cursor, input.sourceIds, input.labels);
    return {
      issues: result.issues.map(issue => linearIssueToIntakeIssue(issue)),
      nextCursor: result.nextCursor,
    };
  }

  async #getIntakeIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const accessToken = getLinearAccessToken(input.connection);
    const issue = await this.fetchIssueDetail(accessToken, input.issueId);
    if (!issue) return null;
    return {
      ...linearIssueToIntakeIssue(issue),
      description: issue.description,
      commentCount: issue.comments.length,
      comments: issue.comments,
    };
  }

  async #createIntakeComment(input: CreateIntakeCommentInput): Promise<{ id: string; url: string } | null> {
    const accessToken = getLinearAccessToken(input.connection);
    return this.createIssueComment(accessToken, input.issueId, input.body);
  }

  /** List the workspace's projects (for the Settings intake-source picker). */
  async listProjects(accessToken: string): Promise<LinearProject[]> {
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

  /**
   * List one page of the workspace's active issues (triage/backlog/unstarted/
   * started — completed and canceled are excluded), most recently updated
   * first. When `projectIds` is provided, only issues from those projects are
   * returned.
   */
  async listActiveIssues(
    accessToken: string,
    after?: string,
    projectIds?: string[],
    labels?: string[],
  ): Promise<LinearIssuePage> {
    const normalizedLabels = [...new Set((labels ?? []).map(label => label.trim()).filter(Boolean))];
    const projectFilter = projectIds?.length ? ', project: { id: { in: $projectIds } }' : '';
    const projectVar = projectIds?.length ? ', $projectIds: [ID!]' : '';
    const labelFilter = normalizedLabels.length > 0 ? ', labels: { name: { in: $labels } }' : '';
    const labelVar = normalizedLabels.length > 0 ? ', $labels: [String!]' : '';
    const data = await linearGraphql<IssuesQueryData>(
      accessToken,
      `query Intake($first: Int!, $after: String${projectVar}${labelVar}) {
        issues(
          first: $first
          after: $after
          orderBy: updatedAt
          filter: { state: { type: { in: ["triage", "backlog", "unstarted", "started"] } }${projectFilter}${labelFilter} }
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
            project { id }
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
        ...(normalizedLabels.length > 0 ? { labels: normalizedLabels } : {}),
      },
    );
    const { nodes, pageInfo } = data.issues;
    return {
      issues: nodes.map(node => ({
        id: node.id,
        projectId: node.project.id,
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

  /** Follow `comments.pageInfo` until exhausted so long discussions aren't truncated. */
  async #fetchRemainingIssueComments(
    accessToken: string,
    issueId: string,
    firstPage: IssueCommentsPage,
  ): Promise<IssueCommentNode[]> {
    const nodes = [...firstPage.nodes];
    let { hasNextPage, endCursor } = firstPage.pageInfo;
    for (let page = 1; hasNextPage && endCursor && page < ISSUE_COMMENTS_MAX_PAGES; page++) {
      const data = await linearGraphql<IssueCommentsQueryData>(
        accessToken,
        `query IssueComments($id: String!, $first: Int!, $after: String!) {
          issue(id: $id) {
            comments(first: $first, after: $after) {
              nodes { body createdAt user { name } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
        { id: issueId, first: ISSUE_COMMENTS_PAGE_SIZE, after: endCursor },
      );
      const comments = data.issue?.comments;
      if (!comments) break;
      nodes.push(...comments.nodes);
      ({ hasNextPage, endCursor } = comments.pageInfo);
    }
    return nodes;
  }

  /**
   * Fetch one issue with its description and comments. `idOrIdentifier`
   * accepts both the Linear UUID and the human key (`ENG-123`). Returns
   * `null` when the issue doesn't exist (Linear reports it as an "Entity not
   * found" error).
   */
  async fetchIssueDetail(accessToken: string, idOrIdentifier: string): Promise<LinearIssueDetail | null> {
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
            project { id }
            assignee { name }
            team { key }
            labels { nodes { name } }
            comments(first: $commentsFirst) {
              nodes { body createdAt user { name } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
        { id: idOrIdentifier, commentsFirst: ISSUE_COMMENTS_PAGE_SIZE },
      );
    } catch (err) {
      // Linear surfaces unknown ids/identifiers as a GraphQL "Entity not
      // found" error rather than a null node — map that to "issue doesn't
      // exist".
      if (err instanceof Error && /entity not found/i.test(err.message)) return null;
      throw err;
    }
    const issue = data.issue;
    if (!issue) return null;
    const allComments = await this.#fetchRemainingIssueComments(accessToken, issue.id, issue.comments);
    const comments = allComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return {
      id: issue.id,
      projectId: issue.project.id,
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

  /**
   * Post a comment on an issue. `idOrIdentifier` accepts both the Linear UUID
   * and the human key (`ENG-123`) — the identifier is resolved to a UUID
   * first because `commentCreate` only accepts UUIDs. Returns `null` when the
   * issue doesn't exist.
   */
  async createIssueComment(
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

  // ── FactoryIntegration surface ───────────────────────────────────────────

  /**
   * The integration's HTTP surface: `/web/linear/*` + `/auth/linear/*` Mastra
   * `apiRoutes` (status, OAuth connect/callback, projects + issues for
   * Intake). Handlers operate on this instance.
   */
  routes(ctx: IntegrationContext): ApiRoute[] {
    return buildLinearRoutes({
      linear: this,
      stateSigner: ctx.stateSigner,
      baseUrl: ctx.baseUrl,
      hooks: ctx.hooks,
    });
  }

  /**
   * Org-scoped agent tools: issue detail + comment tools for sessions whose
   * project belongs to an org with an active Linear connection.
   */
  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildLinearAgentTools({ requestContext: args.requestContext, linear: this });
  }

  /** Non-secret config snapshot for system diagnostics/startup logs. */
  diagnostics(): Record<string, unknown> {
    return {
      oauthAppConfigured: true,
    };
  }
}

function getLinearAccessToken(connection: IntegrationConnection): string {
  if (connection.type !== 'oauth') {
    throw new Error('Linear capabilities require an OAuth connection.');
  }
  return connection.accessToken;
}

function linearIssueToIntakeIssue(issue: LinearIssue): IntakeIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    author: null,
    state: issue.state,
    stateType: issue.stateType,
    priority: issue.priorityLabel,
    assignee: issue.assignee,
    source: issue.team,
    labels: issue.labels,
    commentCount: null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}
