/**
 * `JiraIntegration` — the self-contained Jira Cloud integration.
 *
 * Implements the system-wide `FactoryIntegration` contract
 * (`../base.ts`): the deploy entry reads the `JIRA_*` env vars ONCE,
 * constructs an instance with explicit credentials, and passes it to
 * `MastraFactory`. Everything Jira-flavored the system does — project/issue
 * reads for Intake and the agent's issue tools — flows through this
 * instance. No other module reads `JIRA_*` env vars.
 *
 * Unlike Linear, credentials are **deployment-global** (Basic auth with
 * `email:apiToken` from the environment): there is no OAuth flow, no state
 * signer, and no per-org connection storage. The `IntegrationConnection`
 * arguments required by the `Intake` contract are accepted but not consulted
 * — the instance's own credentials authenticate every call.
 */

import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import type {
  CreateIntakeCommentInput,
  CreatedIntakeComment,
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeItemPage,
  IntakeSource,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../capabilities/intake.js';
import type { RouteAuth } from '../../routes/route.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../base.js';
import { adfToText } from './adf.js';
import { buildJiraAgentTools } from './agent-tools.js';
import type { JiraComment, JiraIssue, JiraTransition } from './api.js';
import { JiraApiClient, JiraApiError } from './api.js';
import { buildJiraRoutes } from './routes.js';

/** Deployment-global Jira Cloud credentials. All fields are required. */
export interface JiraIntegrationConfig {
  /** Site base URL, e.g. `https://acme.atlassian.net`. */
  baseUrl: string;
  /** Atlassian account email the API token belongs to. */
  email: string;
  /** API token from id.atlassian.com → Security → API tokens. */
  apiToken: string;
}

/** Hard stop for comment pagination so a misbehaving `total` can't loop forever. */
const ISSUE_COMMENTS_MAX_PAGES = 20;

/** Jira issue keys look like `ENG-42`. */
const ISSUE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Capability state types (`capabilities/intake.ts`) → Jira status-category
 * keys. `canceled` has no Jira category — it is resolved separately against
 * `done`-category transitions whose status name contains "cancel".
 */
const STATE_TYPE_TO_CATEGORY: Record<'unstarted' | 'started' | 'completed', string> = {
  unstarted: 'new',
  started: 'indeterminate',
  completed: 'done',
};

/** Jira status-category keys → capability state types. */
function stateTypeFromCategory(key: string | undefined): string | null {
  switch (key) {
    case 'new':
      return 'unstarted';
    case 'indeterminate':
      return 'started';
    case 'done':
      return 'completed';
    default:
      return null;
  }
}

export class JiraIntegration implements FactoryIntegration {
  /** Stable integration identifier (see `../base.ts`). */
  readonly id = 'jira';

  readonly #config: JiraIntegrationConfig;
  /** Typed REST client bound to the deployment credentials. */
  readonly api: JiraApiClient;

  /** Bound once by the factory via `initialize()` before any surface is used. */
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();

  constructor(config: JiraIntegrationConfig) {
    // JiraApiClient validates the credential group and normalizes the URL.
    this.api = new JiraApiClient(config);
    this.#config = config;
  }

  /**
   * Bind the projects domain and the host auth seam. Jira has no per-org
   * connection rows, so the generic storage handle is unused — credentials
   * are deployment-global constructor config.
   */
  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
  }

  /** Factory projects domain — maps a session's resourceId to its owning org. */
  get projects(): FactoryProjectsStorage {
    if (!this.#projects) {
      throw new Error('JiraIntegration is not initialized — the factory binds storage during prepare().');
    }
    return this.#projects;
  }

  /**
   * Whether the host runs with web auth enabled. Intake selections are
   * org-owned, so every Jira surface is inert without a tenant auth seam.
   */
  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
  }

  /**
   * Map a session's resourceId (the factory project id) to its owning org.
   * Same caching semantics as the Linear integration: definitive misses are
   * cached, transient database failures are not.
   */
  async resolveOrgId(resourceId: string): Promise<string | null> {
    const cached = this.#orgIdByResourceId.get(resourceId);
    if (cached !== undefined) return cached;
    // Non-UUID resource ids (local/dev resources) would make the uuid column
    // comparison throw — they're definitively "not a project", so cache that.
    if (!UUID_PATTERN.test(resourceId)) {
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

  /** Test hook: clear the org cache between specs. */
  clearCaches(): void {
    this.#orgIdByResourceId.clear();
  }

  /** Normalized site base URL (no trailing slash) — `/browse/<key>` links hang off this. */
  get baseUrl(): string {
    return this.api.baseUrl;
  }

  readonly intake: Intake = {
    resolveIntakeDispatch: input => this.#resolveIntakeDispatch(input),
    listSources: () => this.#listSources(),
    listItems: input => this.#listItems(input),
    listIssues: input => this.#listIssues(input),
    getIssue: input => this.#getIssue(input),
    createComment: input => this.#createComment(input),
    updateIssue: input => this.#updateIssue(input),
  };

  /**
   * Background-dispatch context. Credentials are deployment-global, so the
   * returned connection is a formality the Jira intake methods ignore; the
   * issue key is stored directly as the work item's `externalId` (mirroring
   * Linear, which stores the issue UUID).
   */
  async #resolveIntakeDispatch({ externalSource }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (externalSource.type !== 'issue') return null;
    return {
      connection: { type: 'oauth', accessToken: this.#config.apiToken },
      issueId: externalSource.externalId,
    };
  }

  /** All the site's projects (Settings intake-source picker), following `isLast` paging. */
  async #listSources(): Promise<IntakeSource[]> {
    const sources: IntakeSource[] = [];
    let startAt = 0;
    for (;;) {
      const page = await this.api.listProjects({ startAt });
      for (const project of page.values) {
        sources.push({
          id: project.id,
          name: project.name,
          type: 'project',
          metadata: { key: project.key },
        });
      }
      if (page.isLast || page.values.length === 0) break;
      startAt += page.values.length;
    }
    return sources;
  }

  async #listItems({ sourceIds, cursor }: ListIntakeItemsInput): Promise<IntakeItemPage> {
    if (sourceIds.length === 0) return { items: [], nextCursor: null };
    const page = await this.listActiveIssues(cursor, sourceIds);
    return {
      items: page.issues.map(issue => ({
        source: { type: 'issue', externalId: issue.identifier, url: issue.url },
        sourceId: issue.sourceId,
        title: `${issue.identifier}: ${issue.title}`,
        status: issue.state ?? undefined,
        labels: issue.labels,
        assignee: issue.assignee,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        metadata: {
          identifier: issue.identifier,
          stateType: issue.stateType,
          priority: issue.priority,
          project: issue.source,
        },
      })),
      nextCursor: page.nextCursor,
    };
  }

  async #listIssues(input: ListIntakeIssuesInput): Promise<{ issues: IntakeIssue[]; nextCursor: string | null }> {
    const page = await this.listActiveIssues(input.cursor, input.sourceIds, input.labels);
    return { issues: page.issues, nextCursor: page.nextCursor };
  }

  /**
   * One page of active issues (status category not Done), most recently
   * updated first, optionally filtered to projects and labels. The
   * capability cursor is Jira's opaque `nextPageToken` passed through.
   */
  async listActiveIssues(
    cursor?: string,
    projectIds?: string[],
    labels?: string[],
  ): Promise<{ issues: Array<IntakeIssue & { sourceId: string }>; nextCursor: string | null }> {
    const page = await this.api.searchIssues({
      jql: buildIntakeJql(projectIds, labels),
      ...(cursor ? { nextPageToken: cursor } : {}),
    });
    return {
      issues: page.issues.map(issue => ({
        ...this.#toIntakeIssue(issue),
        sourceId: issue.fields.project?.id ?? '',
      })),
      nextCursor: page.nextPageToken ?? null,
    };
  }

  async #getIssue({ issueId }: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    let issue: JiraIssue;
    try {
      issue = await this.api.getIssue(issueId);
    } catch (err) {
      if (err instanceof JiraApiError && err.status === 404) return null;
      throw err;
    }
    const { comments, total } = await this.#listAllComments(issue.key);
    return {
      ...this.#toIntakeIssue(issue),
      commentCount: total,
      description: issue.fields.description ? adfToText(issue.fields.description) || null : null,
      comments: comments.map(comment => ({
        author: comment.author?.displayName ?? null,
        body: adfToText(comment.body),
        createdAt: comment.created,
      })),
    };
  }

  /** Every comment on the issue, oldest first, bounded by {@link ISSUE_COMMENTS_MAX_PAGES}. */
  async #listAllComments(keyOrId: string): Promise<{ comments: JiraComment[]; total: number }> {
    const comments: JiraComment[] = [];
    let total = 0;
    for (let page = 0; page < ISSUE_COMMENTS_MAX_PAGES; page++) {
      const result = await this.api.listComments(keyOrId, { startAt: comments.length });
      comments.push(...result.comments);
      total = result.total;
      if (result.comments.length === 0 || comments.length >= total) break;
    }
    return { comments, total };
  }

  async #createComment({ issueId, body }: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
    // The browse URL needs the issue key; resolve it when the caller passed a
    // numeric id instead.
    let key = issueId;
    if (!ISSUE_KEY_PATTERN.test(issueId)) {
      try {
        key = (await this.api.getIssue(issueId)).key;
      } catch (err) {
        if (err instanceof JiraApiError && err.status === 404) return null;
        throw err;
      }
    }
    const comment = await this.api.createComment(key, body);
    return {
      id: comment.id,
      url: `${this.baseUrl}/browse/${key}?focusedCommentId=${comment.id}`,
    };
  }

  /**
   * Move an issue to a target state by applying a workflow transition. Jira
   * only exposes transitions that are currently legal, so a policy miss (no
   * transition reaches the target) returns `null` per the `Intake` contract —
   * infrastructure errors (network, auth) still throw.
   */
  async #updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    let issue: JiraIssue;
    try {
      issue = await this.api.getIssue(input.issueId);
    } catch (err) {
      if (err instanceof JiraApiError && err.status === 404) return null;
      throw err;
    }
    if (currentStatusMatches(issue, input.state)) {
      return this.#toIntakeIssue(issue);
    }
    const transitions = await this.api.listTransitions(issue.key);
    const transition = resolveTransition(transitions, input.state);
    if (!transition) return null;
    await this.api.applyTransition(issue.key, transition.id);
    const fresh = await this.api.getIssue(issue.key);
    return this.#toIntakeIssue(fresh);
  }

  #toIntakeIssue(issue: JiraIssue): IntakeIssue {
    const { fields } = issue;
    return {
      id: issue.id,
      identifier: issue.key,
      title: fields.summary ?? issue.key,
      url: `${this.baseUrl}/browse/${issue.key}`,
      author: fields.reporter?.displayName ?? null,
      state: fields.status?.name ?? null,
      stateType: stateTypeFromCategory(fields.status?.statusCategory?.key),
      priority: fields.priority?.name ?? null,
      assignee: fields.assignee?.displayName ?? null,
      source: fields.project?.key ?? null,
      labels: fields.labels ?? [],
      commentCount: null,
      createdAt: fields.created ?? '',
      updatedAt: fields.updated ?? '',
    };
  }

  // ── FactoryIntegration surface ───────────────────────────────────────────

  /**
   * The integration's HTTP surface: `/web/jira/*` Mastra `apiRoutes` (status,
   * projects + issues for Intake). No OAuth routes — credentials are
   * deployment-global. Handlers operate on this instance.
   */
  routes(ctx: IntegrationContext): ApiRoute[] {
    return buildJiraRoutes({
      jira: this,
      auth: ctx.auth,
      intake: ctx.storage.intake,
      projects: ctx.storage.projects,
    });
  }

  /**
   * Org-scoped agent tools: the read-only issue-detail tool for sessions whose
   * resource is a factory project (Jira credentials are deployment-global,
   * so no per-org connection gates apply). v1 exposes no mutating Jira tools.
   */
  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildJiraAgentTools({ requestContext: args.requestContext, jira: this });
  }

  /** Non-secret config snapshot for system diagnostics/startup logs. */
  diagnostics(): Record<string, unknown> {
    return {
      configured: true,
      site: new URL(this.baseUrl).host,
      email: maskEmail(this.#config.email),
    };
  }
}

/** `ops@acme.test` → `o***@acme.test` — enough to identify, never the value. */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Build the intake JQL. Source ids and labels come from stored org config /
 * request input, so both are sanitized before interpolation: numeric project
 * ids pass through bare, project keys are restricted to a safe charset, and
 * label quotes/backslashes are stripped.
 */
function buildIntakeJql(projectIds?: string[], labels?: string[]): string {
  const clauses: string[] = [];
  const safeProjects = (projectIds ?? [])
    .map(id => id.trim())
    .filter(id => /^[A-Za-z0-9_]+$/.test(id))
    .map(id => (/^\d+$/.test(id) ? id : `"${id}"`));
  if (safeProjects.length > 0) {
    clauses.push(`project IN (${safeProjects.join(', ')})`);
  }
  clauses.push('statusCategory != Done');
  const safeLabels = [
    ...new Set(
      (labels ?? []).map(label => label.trim().replace(/["\\]/g, '')).filter(Boolean),
    ),
  ];
  if (safeLabels.length > 0) {
    clauses.push(`labels IN (${safeLabels.map(label => `"${label}"`).join(', ')})`);
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}

/** Whether the issue is already in the requested target state. */
function currentStatusMatches(issue: JiraIssue, target: UpdateIntakeIssueInput['state']): boolean {
  const status = issue.fields.status;
  if (!status) return false;
  if (target.kind === 'byName') {
    return status.name.toLowerCase() === target.name.toLowerCase();
  }
  if (target.stateType === 'canceled') {
    return status.statusCategory?.key === 'done' && /cancel/i.test(status.name);
  }
  return status.statusCategory?.key === STATE_TYPE_TO_CATEGORY[target.stateType];
}

/** Resolve the target state against the issue's currently-legal transitions. */
function resolveTransition(
  transitions: JiraTransition[],
  target: UpdateIntakeIssueInput['state'],
): JiraTransition | null {
  if (target.kind === 'byName') {
    const wanted = target.name.toLowerCase();
    return transitions.find(transition => transition.to?.name.toLowerCase() === wanted) ?? null;
  }
  if (target.stateType === 'canceled') {
    return (
      transitions.find(
        transition => transition.to?.statusCategory?.key === 'done' && /cancel/i.test(transition.to.name),
      ) ?? null
    );
  }
  const category = STATE_TYPE_TO_CATEGORY[target.stateType];
  return transitions.find(transition => transition.to?.statusCategory?.key === category) ?? null;
}
