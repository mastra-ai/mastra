import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';

import type { IntegrationConnection } from '../../capabilities/connection.js';
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
import { buildGitLabAgentTools } from './agent-tools.js';
import {
  GITLAB_ISSUES_PAGE_SIZE,
  GITLAB_NOTES_PAGE_SIZE,
  GITLAB_PROJECTS_PAGE_SIZE,
  GitLabApiClient,
  GitLabApiError,
} from './api.js';
import type { GitLabIssue, GitLabNote, GitLabProject } from './api.js';

interface GitLabConnectionContext {
  id: string;
  label: string | null;
  api: GitLabApiClient;
  connection: IntegrationConnection;
}

interface GitLabSourceReference {
  connectionId: string;
  projectId: string;
  projectPath: string;
}

interface GitLabIssueReference extends GitLabSourceReference {
  issueIid: number;
}

interface GitLabPageCursor {
  source: number;
  page: number;
}

const DIRECT_CONNECTION_ID = 'direct';
const GITLAB_CONNECTION_TOKEN_PREFIX = 'gitlab-connection:';
const GITLAB_SOURCE_PREFIX = 'gitlab-project:';
const GITLAB_ISSUE_PREFIX = 'gitlab-issue:';
const MAX_NOTES_PAGES = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export abstract class GitLabIntegrationBase implements FactoryIntegration {
  readonly id = 'gitlab';
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();

  readonly intake: Intake = {
    resolveIntakeDispatch: input => this.#resolveIntakeDispatch(input),
    listSources: () => this.#listSources(),
    listItems: input => this.#listItems(input),
    listIssues: input => this.#listIssues(input),
    getIssue: input => this.#getIssue(input),
    createComment: input => this.#createComment(input),
    updateIssue: input => this.#updateIssue(input),
  };

  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
  }

  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
  }

  get projects(): FactoryProjectsStorage {
    if (!this.#projects) {
      throw new Error(`${this.constructor.name} is not initialized — the factory binds storage during prepare().`);
    }
    return this.#projects;
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
  }

  abstract hasActiveConnections(): Promise<boolean>;
  abstract authFailureMessage(): string;
  protected abstract activeContexts(): Promise<GitLabConnectionContext[]>;
  protected abstract contextById(connectionId: string): Promise<GitLabConnectionContext>;

  routes(_ctx: IntegrationContext): ApiRoute[] {
    return [];
  }

  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildGitLabAgentTools({ requestContext: args.requestContext, gitlab: this });
  }

  abstract diagnostics(): Record<string, unknown>;

  async #resolveIntakeDispatch({ externalSource }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (externalSource.type !== 'issue') return null;
    const reference = decodeIssueReference(externalSource.externalId);
    if (!reference) return null;
    const context = await this.contextById(reference.connectionId);
    return {
      connection: context.connection,
      sourceId: encodeSourceId({
        connectionId: reference.connectionId,
        projectId: reference.projectId,
        projectPath: reference.projectPath,
      }),
      issueId: String(reference.issueIid),
    };
  }

  async #listSources(): Promise<IntakeSource[]> {
    const sources: IntakeSource[] = [];
    for (const context of await this.activeContexts()) {
      for (let page = 1; ; page++) {
        const projects = await context.api.listProjects({ page });
        sources.push(...projects.map(project => this.#toIntakeSource(context, project)));
        if (projects.length < GITLAB_PROJECTS_PAGE_SIZE) break;
      }
    }
    return sources;
  }

  async #listItems(input: ListIntakeItemsInput): Promise<IntakeItemPage> {
    const result = await this.#listIssuePage(input.sourceIds, input.cursor);
    return {
      items: result.issues.map(({ issue, source, context }) => ({
        source: {
          type: 'issue',
          externalId: encodeIssueReference({ ...source, issueIid: issue.iid }),
          url: issue.web_url,
        },
        sourceId: encodeSourceId(source),
        title: `${source.projectPath}#${issue.iid}: ${issue.title}`,
        status: issue.state,
        labels: issue.labels ?? [],
        assignee: displayName(issue.assignee),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        metadata: {
          identifier: `${source.projectPath}#${issue.iid}`,
          projectId: source.projectId,
          projectPath: source.projectPath,
          connectionId: context.id,
          accountLabel: context.label,
        },
      })),
      nextCursor: result.nextCursor,
    };
  }

  async #listIssues(input: ListIntakeIssuesInput) {
    const result = await this.#listIssuePage(input.sourceIds, input.cursor, input.labels);
    return {
      issues: result.issues.map(({ issue, source }) => this.#toIntakeIssue(issue, source.projectPath)),
      nextCursor: result.nextCursor,
    };
  }

  async #listIssuePage(sourceIds: string[], cursor?: string, labels?: string[]) {
    const sources = sourceIds.map(decodeSourceId).filter((source): source is GitLabSourceReference => source !== null);
    if (sources.length === 0) return { issues: [], nextCursor: null };
    const current = decodePageCursor(cursor);
    if (!current || current.source >= sources.length) return { issues: [], nextCursor: null };

    for (let sourceIndex = current.source; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex]!;
      const context = await this.contextById(source.connectionId);
      const page = sourceIndex === current.source ? current.page : 1;
      const issues = await context.api.listIssues(source.projectId, { page, labels });
      const nextCursor =
        issues.length === GITLAB_ISSUES_PAGE_SIZE
          ? encodePageCursor({ source: sourceIndex, page: page + 1 })
          : sourceIndex + 1 < sources.length
            ? encodePageCursor({ source: sourceIndex + 1, page: 1 })
            : null;
      return { issues: issues.map(issue => ({ issue, source, context })), nextCursor };
    }
    return { issues: [], nextCursor: null };
  }

  async #getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const resolved = await this.#resolveRequest(input);
    let issue: GitLabIssue;
    try {
      issue = await resolved.context.api.getIssue(resolved.projectId, resolved.issueIid);
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) return null;
      throw error;
    }
    const notes = await this.#listAllNotes(resolved.context.api, resolved.projectId, resolved.issueIid);
    return {
      ...this.#toIntakeIssue(issue, resolved.projectPath),
      description: issue.description?.trim() || null,
      comments: notes
        .filter(note => !note.system)
        .map(note => ({ author: displayName(note.author), body: note.body, createdAt: note.created_at })),
    };
  }

  async #listAllNotes(api: GitLabApiClient, projectId: string, issueIid: number): Promise<GitLabNote[]> {
    const notes: GitLabNote[] = [];
    for (let page = 1; page <= MAX_NOTES_PAGES; page++) {
      const result = await api.listNotes(projectId, issueIid, { page });
      notes.push(...result);
      if (result.length < GITLAB_NOTES_PAGE_SIZE) break;
    }
    return notes;
  }

  async #createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
    const resolved = await this.#resolveRequest(input);
    try {
      const issue = await resolved.context.api.getIssue(resolved.projectId, resolved.issueIid);
      const note = await resolved.context.api.createNote(resolved.projectId, resolved.issueIid, input.body);
      return { id: String(note.id), url: `${issue.web_url}#note_${note.id}` };
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) return null;
      throw error;
    }
  }

  async #updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    const resolved = await this.#resolveRequest(input);
    let issue: GitLabIssue;
    try {
      issue = await resolved.context.api.getIssue(resolved.projectId, resolved.issueIid);
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) return null;
      throw error;
    }
    const stateEvent = targetStateEvent(input);
    if (!stateEvent) return null;
    if ((stateEvent === 'close' && issue.state === 'closed') || (stateEvent === 'reopen' && issue.state === 'opened')) {
      return this.#toIntakeIssue(issue, resolved.projectPath);
    }
    const updated = await resolved.context.api.updateIssueState(resolved.projectId, resolved.issueIid, stateEvent);
    return this.#toIntakeIssue(updated, resolved.projectPath);
  }

  async #resolveRequest(input: GetIntakeIssueInput): Promise<{
    context: GitLabConnectionContext;
    projectId: string;
    projectPath: string;
    issueIid: number;
  }> {
    const issueReference = decodeIssueReference(input.issueId);
    const source = input.sourceId ? decodeSourceId(input.sourceId) : null;
    const locator = parseIssueLocator(input.issueId);
    const connectionId =
      issueReference?.connectionId ?? source?.connectionId ?? connectionIdFromConnection(input.connection);
    const contexts = connectionId ? [await this.contextById(connectionId)] : await this.activeContexts();
    if (contexts.length !== 1) {
      throw new GitLabApiError(
        'GitLab issue reference must identify a connection when multiple GitLab accounts are connected.',
        400,
      );
    }
    const projectId = issueReference?.projectId ?? source?.projectId ?? locator?.projectPath;
    const projectPath = issueReference?.projectPath ?? source?.projectPath ?? locator?.projectPath;
    const issueIid = issueReference?.issueIid ?? locator?.issueIid ?? parsePositiveInteger(input.issueId);
    if (!projectId || !projectPath || !issueIid) {
      throw new GitLabApiError(
        'GitLab issue must include a project and issue IID (for example, group/project#42).',
        400,
      );
    }
    return {
      context: contexts[0]!,
      projectId,
      projectPath,
      issueIid,
    };
  }

  #toIntakeSource(context: GitLabConnectionContext, project: GitLabProject): IntakeSource {
    const reference: GitLabSourceReference = {
      connectionId: context.id,
      projectId: String(project.id),
      projectPath: project.path_with_namespace,
    };
    return {
      id: encodeSourceId(reference),
      name: project.path_with_namespace,
      type: 'project',
      metadata: {
        projectId: String(project.id),
        projectPath: project.path_with_namespace,
        defaultBranch: project.default_branch ?? null,
        connectionId: context.id,
        accountLabel: context.label,
        url: project.web_url,
      },
    };
  }

  #toIntakeIssue(issue: GitLabIssue, projectPath: string): IntakeIssue {
    const assignees = issue.assignees?.map(displayName).filter((name): name is string => name !== null) ?? [];
    return {
      id: String(issue.id),
      identifier: `${projectPath}#${issue.iid}`,
      title: issue.title,
      url: issue.web_url,
      author: displayName(issue.author),
      state: issue.state,
      stateType: issue.state === 'closed' ? 'completed' : 'unstarted',
      priority: issue.severity && issue.severity !== 'unknown' ? issue.severity : null,
      assignee: displayName(issue.assignee) ?? assignees[0] ?? null,
      assignees,
      source: projectPath,
      labels: issue.labels ?? [],
      commentCount: issue.user_notes_count ?? null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }
}

export interface GitLabIntegrationConfig {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class GitLabIntegration extends GitLabIntegrationBase {
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #context: GitLabConnectionContext;

  constructor(config: GitLabIntegrationConfig) {
    super();
    this.#accessToken = config.accessToken.trim();
    this.#baseUrl = (config.baseUrl ?? 'https://gitlab.com').replace(/\/+$/, '');
    const api = new GitLabApiClient({
      baseUrl: this.#baseUrl,
      accessToken: this.#accessToken,
      fetchImpl: config.fetchImpl,
    });
    this.#context = {
      id: DIRECT_CONNECTION_ID,
      label: new URL(this.#baseUrl).host,
      api,
      connection: { type: 'oauth', accessToken: this.#accessToken },
    };
  }

  async hasActiveConnections(): Promise<boolean> {
    return true;
  }

  authFailureMessage(): string {
    return 'GitLab rejected the configured access token. Check the GitLab token.';
  }

  protected async activeContexts(): Promise<GitLabConnectionContext[]> {
    return [this.#context];
  }

  protected async contextById(connectionId: string): Promise<GitLabConnectionContext> {
    if (connectionId !== DIRECT_CONNECTION_ID) {
      throw new GitLabApiError('GitLab connection is unavailable.', 401);
    }
    return this.#context;
  }

  diagnostics(): Record<string, unknown> {
    return { configured: true, mode: 'direct', endpointHost: new URL(this.#baseUrl).host };
  }
}

export function encodeSourceId(reference: GitLabSourceReference): string {
  return `${GITLAB_SOURCE_PREFIX}${encodeOpaque(reference)}`;
}

export function decodeSourceId(value: string): GitLabSourceReference | null {
  return decodeOpaque(value, GITLAB_SOURCE_PREFIX, isSourceReference);
}

export function encodeIssueReference(reference: GitLabIssueReference): string {
  return `${GITLAB_ISSUE_PREFIX}${encodeOpaque(reference)}`;
}

export function decodeIssueReference(value: string): GitLabIssueReference | null {
  return decodeOpaque(value, GITLAB_ISSUE_PREFIX, isIssueReference);
}

export function gitlabConnection(connectionId: string): IntegrationConnection {
  return { type: 'oauth', accessToken: `${GITLAB_CONNECTION_TOKEN_PREFIX}${connectionId}` };
}

function connectionIdFromConnection(connection: IntegrationConnection): string | null {
  if (connection.type !== 'oauth' || !connection.accessToken.startsWith(GITLAB_CONNECTION_TOKEN_PREFIX)) return null;
  return connection.accessToken.slice(GITLAB_CONNECTION_TOKEN_PREFIX.length) || null;
}

function encodeOpaque(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeOpaque<T>(value: string, prefix: string, guard: (value: unknown) => value is T): T | null {
  if (!value.startsWith(prefix)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value.slice(prefix.length), 'base64url').toString('utf8')) as unknown;
    return guard(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function isSourceReference(value: unknown): value is GitLabSourceReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return (
    typeof ref.connectionId === 'string' &&
    ref.connectionId.length > 0 &&
    typeof ref.projectId === 'string' &&
    ref.projectId.length > 0 &&
    typeof ref.projectPath === 'string' &&
    ref.projectPath.length > 0
  );
}

function isIssueReference(value: unknown): value is GitLabIssueReference {
  return (
    isSourceReference(value) &&
    Number.isSafeInteger((value as GitLabIssueReference).issueIid) &&
    (value as GitLabIssueReference).issueIid > 0
  );
}

function encodePageCursor(cursor: GitLabPageCursor): string {
  return encodeOpaque(cursor);
}

function decodePageCursor(value: string | undefined): GitLabPageCursor | null {
  if (!value) return { source: 0, page: 1 };
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (!Number.isSafeInteger(decoded.source) || Number(decoded.source) < 0) return null;
    if (!Number.isSafeInteger(decoded.page) || Number(decoded.page) < 1) return null;
    return { source: Number(decoded.source), page: Number(decoded.page) };
  } catch {
    return null;
  }
}

function displayName(user: { name?: string | null; username: string } | null | undefined): string | null {
  return user?.name?.trim() || user?.username || null;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseIssueLocator(value: string): {
  projectPath: string;
  issueIid: number;
} | null {
  const shorthand = value.match(/^(.+?)#(\d+)$/);
  if (shorthand) {
    const issueIid = parsePositiveInteger(shorthand[2]!);
    const projectPath = shorthand[1]!.replace(/^\/+|\/+$/g, '');
    return issueIid && projectPath ? { projectPath, issueIid } : null;
  }
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/(.+)\/-\/issues\/(\d+)\/?$/);
    if (!match) return null;
    const issueIid = parsePositiveInteger(match[2]!);
    if (!issueIid) return null;
    const projectPath = decodeURIComponent(match[1]!);
    return { projectPath, issueIid };
  } catch {
    return null;
  }
}

function targetStateEvent(input: UpdateIntakeIssueInput): 'close' | 'reopen' | null {
  if (input.state.kind === 'byType') {
    return input.state.stateType === 'completed' || input.state.stateType === 'canceled' ? 'close' : 'reopen';
  }
  const name = input.state.name.trim().toLowerCase();
  if (name === 'closed' || name === 'close') return 'close';
  if (name === 'opened' || name === 'open' || name === 'reopen') return 'reopen';
  return null;
}
