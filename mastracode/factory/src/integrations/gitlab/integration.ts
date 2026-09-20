import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

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
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools } from '../base.js';
import { IssueReconcileWorker } from '../issue-reconcile-worker.js';
import { buildGitLabAgentTools } from './agent-tools.js';
import {
  GITLAB_ISSUES_PAGE_SIZE,
  GITLAB_NOTES_PAGE_SIZE,
  GITLAB_PROJECTS_PAGE_SIZE,
  GitLabApiClient,
  GitLabApiError,
} from './api.js';
import type { GitLabIssue, GitLabNote, GitLabProject } from './api.js';
import { resolveGitLabRules } from './default-rules.js';
import type { GitLabEventRules, GitLabRuleOverrides } from './default-rules.js';
import { attachGitLabReconciler } from './reconciler.js';
import { gitlabReconciliationEnabled, gitlabReconciliationInterval } from './reconciliation-config.js';
import { buildGitLabRoutes } from './routes.js';
import { attachGitLabRules } from './rules.js';
import { buildGitLabVersionControl } from './version-control.js';

interface GitLabConnectionContext {
  id: string;
  label: string | null;
  api: GitLabApiClient;
  connection: IntegrationConnection;
  host: string;
  webBaseUrl?: string;
  /** Resolves a fresh provider token for a single brokered git operation. */
  repositoryAccessToken?: () => Promise<string>;
}

interface GitLabSourceReference {
  /** Present only on legacy v1 ids; authentication is not resource identity. */
  connectionId?: string;
  /** Canonical v2 ids use the GitLab instance host plus immutable project id. */
  host?: string;
  projectId: string;
  /** Legacy ids carry display metadata; v2 resolves it from GitLab. */
  projectPath?: string;
}

interface ResolvedGitLabSourceReference extends GitLabSourceReference {
  connectionId: string;
  host: string;
  projectPath: string;
}

interface GitLabIssueReference extends GitLabSourceReference {
  issueIid: number;
}

export interface GitLabMergeRequestReference {
  version: 1;
  host: string;
  projectId: number;
  mergeRequestIid: number;
}

interface GitLabPageCursor {
  source: number;
  page: number;
}

export interface GitLabStatusConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

const DIRECT_CONNECTION_ID = 'direct';
const GITLAB_CONNECTION_TOKEN_PREFIX = 'gitlab-connection:';
const GITLAB_SOURCE_PREFIX = 'gitlab-project:';
const GITLAB_ISSUE_PREFIX = 'gitlab-issue:';
const GITLAB_MERGE_REQUEST_PREFIX = 'gitlab-pr:';
export const GITLAB_TRUSTED_ACCESS_LEVEL = 30;
// Bound issue detail reads to 2,000 notes. GitLab does not expose truncation through the Intake contract.
const MAX_NOTES_PAGES = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export abstract class GitLabIntegrationBase implements FactoryIntegration {
  readonly id = 'gitlab';
  #projects: FactoryProjectsStorage | undefined;
  #sourceControl: SourceControlStorageHandle | undefined;
  #auth: RouteAuth | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();
  readonly rules: GitLabEventRules;

  constructor(rules?: GitLabRuleOverrides) {
    this.rules = resolveGitLabRules(rules);
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
  readonly versionControl = buildGitLabVersionControl({
    contextForConnection: connection => this.#versionControlContext(connection),
    contextForStoredInstallation: (connection, host) => this.#versionControlContextForInstallation(connection, host),
  });
  initialize({
    projects,
    auth,
    sourceControl,
  }: {
    projects: FactoryProjectsStorage;
    auth: RouteAuth;
    sourceControl?: SourceControlStorageHandle;
  }): void {
    this.#projects = projects;
    this.#auth = auth;
    this.#sourceControl = sourceControl;
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

  /** Resolve only a GitLab repository linked to this Factory in this organization. */
  async getLinkedRepository(input: { orgId: string; factoryProjectId: string; projectRepositoryId: string }) {
    if (!this.#sourceControl) return null;
    const connections = await this.#sourceControl.connections.list({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
    });
    for (const connection of connections) {
      if (connection.integrationId !== 'gitlab') continue;
      const links = await this.#sourceControl.projectRepositories.list({ orgId: input.orgId, connectionId: connection.id });
      const link = links.find(candidate => candidate.id === input.projectRepositoryId);
      if (!link) continue;
      const repository = await this.#sourceControl.repositories.get({ orgId: input.orgId, id: link.repositoryId });
      const installation = await this.#sourceControl.installations.get({ orgId: input.orgId, id: connection.installationId });
      if (!repository || !installation) return null;
      const host = installation.providerMetadata.host;
      if (typeof host !== 'string' || !host) return null;
      return { repository, host: normalizeGitLabHost(host) };
    }
    return null;
  }

  async getProjectMemberAccessLevel(
    connectionId: string,
    projectId: string,
    username: string,
  ): Promise<number | undefined> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return undefined;
    const members = await (await this.contextById(connectionId)).api.listProjectMembers(projectId, { query: username });
    const member = members.find(
      candidate => candidate.username.toLowerCase() === normalized && candidate.state !== 'blocked',
    );
    return member?.access_level;
  }

  async getWorkItemAuthorUsername(
    connectionId: string,
    projectId: string,
    kind: 'issue' | 'merge_request',
    iid: number,
  ): Promise<string | undefined> {
    const api = (await this.contextById(connectionId)).api;
    const item = kind === 'issue' ? await api.getIssue(projectId, iid) : await api.getMergeRequest(projectId, iid);
    return item.author?.username;
  }

  async isProjectMemberTrustedForSource(sourceId: string, username: string): Promise<boolean> {
    const reference = decodeSourceId(sourceId);
    if (!reference) throw new GitLabApiError('GitLab source identity is invalid.', 400);
    const { context, source } = await this.#resolveSourceReference(reference);
    const accessLevel = await this.getProjectMemberAccessLevel(context.id, source.projectId, username);
    return (accessLevel ?? 0) >= GITLAB_TRUSTED_ACCESS_LEVEL;
  }

  async getIssueForFactoryProject(input: {
    orgId: string;
    factoryProjectId: string;
    issueId: string;
  }): Promise<IntakeIssueDetail | null> {
    if (!this.#sourceControl) throw new GitLabApiError('GitLab source control is unavailable.', 503);
    const reference = decodeIssueReference(input.issueId);
    const locator = parseIssueLocator(input.issueId);
    if (!reference && !locator) {
      throw new GitLabApiError('GitLab issue must include a project and issue IID.', 400);
    }

    const normalizePath = (value: string) => value.replace(/^\/+|\/+$/g, '').toLowerCase();
    const matches: Array<{
      connectionId: string;
      projectId: string;
      projectPath: string;
    }> = [];
    const connections = await this.#sourceControl.connections.list({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
    });
    for (const connection of connections) {
      const installation = await this.#sourceControl.installations.get({
        orgId: input.orgId,
        id: connection.installationId,
      });
      if (!installation) continue;
      for (const projectRepository of await this.#sourceControl.projectRepositories.list({
        orgId: input.orgId,
        connectionId: connection.id,
      })) {
        const repository = await this.#sourceControl.repositories.get({
          orgId: input.orgId,
          id: projectRepository.repositoryId,
        });
        if (!repository) continue;
        if (reference?.projectId && repository.externalId !== reference.projectId) continue;
        if (reference?.projectPath && normalizePath(repository.slug) !== normalizePath(reference.projectPath)) continue;
        if (locator?.projectPath && normalizePath(repository.slug) !== normalizePath(locator.projectPath)) continue;
        if (reference?.connectionId && installation.externalId !== reference.connectionId) continue;
        const installationHost =
          typeof installation.providerMetadata.host === 'string'
            ? normalizeGitLabHost(installation.providerMetadata.host)
            : null;
        if (reference?.host && installationHost !== normalizeGitLabHost(reference.host)) continue;
        if (locator?.host && installationHost !== normalizeGitLabHost(locator.host)) continue;
        matches.push({
          connectionId: installation.externalId,
          projectId: repository.externalId,
          projectPath: repository.slug,
        });
      }
    }
    const match = matches.sort((left, right) => left.connectionId.localeCompare(right.connectionId))[0];
    if (!match) throw new GitLabApiError('GitLab issue is outside the active Factory project.', 404);
    return this.intake.getIssue({
      connection: gitlabConnection(match.connectionId),
      sourceId: encodeSourceId(match),
      issueId: input.issueId,
    });
  }

  /** Platform mode exposes org connections; direct mode returns undefined. */
  async statusConnections(): Promise<GitLabStatusConnection[] | undefined> {
    return undefined;
  }

  /** Direct mode verifies its configured credential; Platform mode uses connection status. */
  async verifyStatus(): Promise<void> {
    // Platform connection state is authoritative unless a provider overrides this probe.
  }

  protected get webhookSecret(): string | undefined {
    return undefined;
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    if (!gitlabReconciliationEnabled()) return [];
    const reconcile = attachGitLabReconciler(this, ctx);
    if (!reconcile) return [];
    const intervalMs = gitlabReconciliationInterval();
    return [
      new IssueReconcileWorker({
        integrationId: this.id,
        reconcile,
        ...(intervalMs ? { intervalMs } : {}),
      }),
    ];
  }
  routes(ctx: IntegrationContext): ApiRoute[] {
    const ingestFactoryEvent = attachGitLabRules(this, ctx);
    return buildGitLabRoutes({
      gitlab: this,
      auth: ctx.auth,
      intake: ctx.storage?.intake,
      emitAudit: ctx.hooks?.emitAudit,
      sandbox: ctx.sandbox,
      webhookSecret: this.webhookSecret,
      ingestFactoryEvent,
    });
  }

  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildGitLabAgentTools({ requestContext: args.requestContext, gitlab: this });
  }

  abstract diagnostics(): Record<string, unknown>;

  /** Prefer the configured direct token over an older Platform installation on the same host. */
  async resolveActiveConnectionForHost(storedConnectionId: string, host: string): Promise<string> {
    if (this.diagnostics().mode !== 'direct') return storedConnectionId;
    const [direct] = await this.activeContexts();
    return direct && normalizeGitLabHost(direct.host) === normalizeGitLabHost(host) ? direct.id : storedConnectionId;
  }

  async #versionControlContext(connection: IntegrationConnection): Promise<GitLabConnectionContext> {
    const connectionId = connectionIdFromConnection(connection);
    if (connectionId) return this.contextById(connectionId);
    const contexts = await this.activeContexts();
    if (contexts.length !== 1) {
      throw new GitLabApiError(
        'GitLab version-control requests must identify a connection when multiple GitLab accounts are connected.',
        400,
      );
    }
    return contexts[0]!;
  }
  async #versionControlContextForInstallation(
    connection: IntegrationConnection,
    host: string | undefined,
  ): Promise<GitLabConnectionContext> {
    // A direct PAT intentionally overrides Platform credentials. Old links can
    // retain their Platform connection id; use the PAT only for the same host.
    if (this.diagnostics().mode === 'direct' && host) {
      const [direct] = await this.activeContexts();
      if (direct && normalizeGitLabHost(host) === normalizeGitLabHost(direct.host)) return direct;
    }
    return this.#versionControlContext(connection);
  }
  async #contextForReference(reference: GitLabSourceReference): Promise<GitLabConnectionContext> {
    if (reference.connectionId) return this.contextById(reference.connectionId);
    const contexts = (await this.activeContexts()).filter(
      context => !reference.host || normalizeGitLabHost(context.host) === normalizeGitLabHost(reference.host),
    );
    if (contexts.length === 0) {
      throw new GitLabApiError('No active GitLab connection can access this source.', 401);
    }
    if (contexts.length === 1) return contexts[0]!;

    if (this.#sourceControl) {
      const linkedConnectionIds = new Set(
        (await this.#sourceControl.projectRepositories.listConfiguredExternalKeys())
          .filter(key => key.repositoryExternalId === reference.projectId)
          .map(key => key.installationExternalId),
      );
      const linked = contexts.filter(context => linkedConnectionIds.has(context.id));
      if (linked.length > 0) return linked.sort((left, right) => left.id.localeCompare(right.id))[0]!;
    }

    for (const context of contexts.sort((left, right) => left.id.localeCompare(right.id))) {
      try {
        await context.api.getProject(reference.projectId);
        return context;
      } catch (error) {
        if (!(error instanceof GitLabApiError) || ![401, 403, 404].includes(error.status ?? 0)) throw error;
        // This credential cannot access the project; try another active account for the same canonical source.
      }
    }
    throw new GitLabApiError('No active GitLab connection can access this source.', 404);
  }

  async #resolveSourceReference(
    reference: GitLabSourceReference,
  ): Promise<{ context: GitLabConnectionContext; source: ResolvedGitLabSourceReference }> {
    const context = await this.#contextForReference(reference);
    const projectPath =
      reference.projectPath ?? (await context.api.getProject(reference.projectId)).path_with_namespace;
    return {
      context,
      source: {
        connectionId: context.id,
        host: normalizeGitLabHost(reference.host ?? context.host),
        projectId: reference.projectId,
        projectPath,
      },
    };
  }

  async #resolveIntakeDispatch({ externalSource }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (externalSource.type !== 'issue') return null;
    const reference = decodeIssueReference(externalSource.externalId);
    if (!reference) return null;
    const { context, source } = await this.#resolveSourceReference(reference);
    return {
      connection: context.connection,
      sourceId: encodeSourceId(source),
      issueId: String(reference.issueIid),
    };
  }

  async #listSources(): Promise<IntakeSource[]> {
    const sources = new Map<string, IntakeSource>();
    for (const context of await this.activeContexts()) {
      for (let page = 1; ; page++) {
        const projects = await context.api.listProjects({ page });
        for (const project of projects) {
          const source = this.#toIntakeSource(context, project);
          if (!sources.has(source.id)) sources.set(source.id, source);
        }
        if (projects.length < GITLAB_PROJECTS_PAGE_SIZE) break;
      }
    }
    return [...sources.values()];
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
          labelColors: Object.fromEntries((issue.labelDetails ?? []).map(label => [label.name, label.color])),
        },
      })),
      nextCursor: result.nextCursor,
    };
  }

  async #listIssues(input: ListIntakeIssuesInput) {
    const result = await this.#listIssuePage(input.sourceIds, input.cursor, input.labels);
    return {
      issues: result.issues.map(({ issue, source }) => ({
        ...this.#toIntakeIssue(issue, source.projectPath),
        sourceId: encodeSourceId(source),
      })),
      nextCursor: result.nextCursor,
    };
  }

  async #listIssuePage(sourceIds: string[], cursor?: string, labels?: string[]) {
    const sources = sourceIds.map(decodeSourceId).filter((source): source is GitLabSourceReference => source !== null);
    if (sources.length === 0) return { issues: [], nextCursor: null };
    const current = decodePageCursor(cursor);
    if (!current || current.source >= sources.length) return { issues: [], nextCursor: null };

    for (let sourceIndex = current.source; sourceIndex < sources.length; sourceIndex++) {
      const { source, context } = await this.#resolveSourceReference(sources[sourceIndex]!);
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
    const reference = issueReference ?? source;
    let context: GitLabConnectionContext;
    if (reference) {
      context = await this.#contextForReference(reference);
    } else {
      const connectionId = connectionIdFromConnection(input.connection);
      const contexts = connectionId ? [await this.contextById(connectionId)] : await this.activeContexts();
      if (contexts.length !== 1) {
        throw new GitLabApiError('GitLab issue reference must resolve to exactly one active connection.', 400);
      }
      context = contexts[0]!;
    }
    const projectId = issueReference?.projectId ?? source?.projectId ?? locator?.projectPath;
    const issueIid = issueReference?.issueIid ?? locator?.issueIid ?? parsePositiveInteger(input.issueId);
    if (!projectId || !issueIid) {
      throw new GitLabApiError(
        'GitLab issue must include a project and issue IID (for example, group/project#42).',
        400,
      );
    }
    const projectPath =
      issueReference?.projectPath ??
      source?.projectPath ??
      locator?.projectPath ??
      (await context.api.getProject(projectId)).path_with_namespace;
    return { context, projectId, projectPath, issueIid };
  }

  #toIntakeSource(context: GitLabConnectionContext, project: GitLabProject): IntakeSource {
    const reference: GitLabSourceReference = {
      host: normalizeGitLabHost(context.host),
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
      id: String(issue.iid),
      identifier: `${projectPath}#${issue.iid}`,
      title: issue.title,
      url: issue.web_url,
      author: displayName(issue.author),
      authorUsername: issue.author?.username ?? null,
      state: issue.state,
      stateType: issue.state === 'closed' ? 'completed' : 'unstarted',
      priority: typeof issue.weight === 'number' ? String(issue.weight) : null,
      assignee: displayName(issue.assignee) ?? assignees[0] ?? null,
      assignees,
      source: projectPath,
      labels: issue.labels ?? [],
      labelColors: Object.fromEntries((issue.labelDetails ?? []).map(label => [label.name, label.color])),
      commentCount: issue.user_notes_count ?? null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }
}

export type GitLabAccessTokenType = 'personal' | 'group';

export interface GitLabIntegrationConfig {
  rules?: GitLabRuleOverrides;
  accessToken?: string;
  /** Defaults to `personal`; both token types authenticate identically but have different resource reach. */
  accessTokenType?: GitLabAccessTokenType;
  baseUrl?: string;
  webhookSecret?: string;
  fetchImpl?: typeof fetch;
}

const DIRECT_CONNECTION_TOKEN = 'gitlab-direct-access-token';

export class GitLabIntegration extends GitLabIntegrationBase {
  readonly #accessToken: string;
  readonly #accessTokenType: GitLabAccessTokenType;
  readonly #baseUrl: string;
  readonly #webhookSecret: string | undefined;
  readonly #context: GitLabConnectionContext;

  constructor(config: GitLabIntegrationConfig = {}) {
    super(config.rules);
    const accessToken = config.accessToken?.trim() || process.env.GITLAB_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new Error('GitLabIntegration: missing required GITLAB_ACCESS_TOKEN.');
    }
    this.#accessToken = accessToken;
    this.#accessTokenType = parseAccessTokenType(
      config.accessTokenType ?? process.env.GITLAB_ACCESS_TOKEN_TYPE?.trim(),
    );
    this.#baseUrl = (config.baseUrl ?? process.env.GITLAB_BASE_URL?.trim() ?? 'https://gitlab.com').replace(/\/+$/, '');
    this.#webhookSecret = config.webhookSecret?.trim() || process.env.GITLAB_WEBHOOK_SECRET?.trim() || undefined;
    const api = new GitLabApiClient({
      baseUrl: this.#baseUrl,
      accessToken: this.#accessToken,
      ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    });
    this.#context = {
      id: DIRECT_CONNECTION_ID,
      label: new URL(this.#baseUrl).host,
      api,
      connection: { type: 'oauth', accessToken: DIRECT_CONNECTION_TOKEN },
      host: new URL(this.#baseUrl).host,
      webBaseUrl: this.#baseUrl,
      repositoryAccessToken: async () => this.#accessToken,
    };
  }

  protected override get webhookSecret(): string | undefined {
    return this.#webhookSecret;
  }

  async hasActiveConnections(): Promise<boolean> {
    return true;
  }

  override async verifyStatus(): Promise<void> {
    await this.#context.api.getCurrentUser();
  }

  authFailureMessage(): string {
    return `GitLab rejected the configured ${this.#accessTokenType} access token. Check the token and its scopes.`;
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
    return {
      configured: true,
      mode: 'direct',
      accessTokenType: this.#accessTokenType,
      endpointHost: new URL(this.#baseUrl).host,
      webhookConfigured: Boolean(this.#webhookSecret),
    };
  }
}

function parseAccessTokenType(value: string | undefined): GitLabAccessTokenType {
  const normalized = value?.trim().toLowerCase() || 'personal';
  if (normalized === 'personal' || normalized === 'group') return normalized;
  throw new Error("GitLabIntegration: GITLAB_ACCESS_TOKEN_TYPE must be 'personal' or 'group'.");
}

export function encodeSourceId(reference: GitLabSourceReference): string {
  if (reference.host) {
    return `${GITLAB_SOURCE_PREFIX}${encodeOpaque({
      version: 2,
      host: normalizeGitLabHost(reference.host),
      projectId: reference.projectId,
    })}`;
  }
  if (!reference.connectionId || !reference.projectPath) {
    throw new Error('GitLab source reference is missing its instance host.');
  }
  return `${GITLAB_SOURCE_PREFIX}${encodeOpaque(reference)}`;
}

export function decodeSourceId(value: string): GitLabSourceReference | null {
  return decodeOpaque(value, GITLAB_SOURCE_PREFIX, isSourceReference);
}

export function encodeIssueReference(reference: GitLabIssueReference): string {
  if (reference.host) {
    return `${GITLAB_ISSUE_PREFIX}${encodeOpaque({
      version: 2,
      host: normalizeGitLabHost(reference.host),
      projectId: reference.projectId,
      issueIid: reference.issueIid,
    })}`;
  }
  if (!reference.connectionId || !reference.projectPath) {
    throw new Error('GitLab issue reference is missing its instance host.');
  }
  return `${GITLAB_ISSUE_PREFIX}${encodeOpaque(reference)}`;
}

export function decodeIssueReference(value: string): GitLabIssueReference | null {
  return decodeOpaque(value, GITLAB_ISSUE_PREFIX, isIssueReference);
}

export function decodeMergeRequestReference(value: string): GitLabMergeRequestReference | null {
  return decodeOpaque(value, GITLAB_MERGE_REQUEST_PREFIX, isMergeRequestReference);
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

function normalizeGitLabHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function isSourceReference(value: unknown): value is GitLabSourceReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  if (typeof ref.projectId !== 'string' || ref.projectId.length === 0) return false;
  const canonical = ref.version === 2 && typeof ref.host === 'string' && normalizeGitLabHost(ref.host).length > 0;
  const legacy =
    typeof ref.connectionId === 'string' &&
    ref.connectionId.length > 0 &&
    typeof ref.projectPath === 'string' &&
    ref.projectPath.length > 0;
  return canonical || legacy;
}

function isIssueReference(value: unknown): value is GitLabIssueReference {
  return (
    isSourceReference(value) &&
    Number.isSafeInteger((value as GitLabIssueReference).issueIid) &&
    (value as GitLabIssueReference).issueIid > 0
  );
}

function isMergeRequestReference(value: unknown): value is GitLabMergeRequestReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return (
    ref.version === 1 &&
    typeof ref.host === 'string' &&
    normalizeGitLabHost(ref.host).length > 0 &&
    Number.isSafeInteger(ref.projectId) &&
    (ref.projectId as number) > 0 &&
    Number.isSafeInteger(ref.mergeRequestIid) &&
    (ref.mergeRequestIid as number) > 0
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
  host?: string;
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
    return { host: url.host, projectPath, issueIid };
  } catch {
    return null;
  }
}

function targetStateEvent(input: UpdateIntakeIssueInput): 'close' | 'reopen' | null {
  if (input.state.kind === 'byType') {
    // GitLab issues have only opened/closed states, so canceled is intentionally mapped to close.
    return input.state.stateType === 'completed' || input.state.stateType === 'canceled' ? 'close' : 'reopen';
  }
  const name = input.state.name.trim().toLowerCase();
  if (name === 'closed' || name === 'close') return 'close';
  if (name === 'opened' || name === 'open' || name === 'reopen') return 'reopen';
  return null;
}
