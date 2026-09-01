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
import { PlatformApiClient, platformIntegrationsApiClientConfigFromEnv } from '../platform/api-client.js';
import { adfToText } from './adf.js';
import { buildJiraAgentTools } from './agent-tools.js';
import type { JiraComment, JiraIssue, JiraTransition } from './api.js';
import { JiraApiClient, JiraApiError } from './api.js';
import { buildJiraRoutes } from './routes.js';

interface PlatformIntegrationConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

interface JiraConnectionContext {
  connection: PlatformIntegrationConnection;
  api: JiraApiClient;
  siteUrl: string;
}

interface JiraIssueReference {
  connectionId: string;
  issueId: string;
  projectId?: string;
}

interface JiraPageCursor {
  group: number;
  jira?: string;
}

const ISSUE_COMMENTS_MAX_PAGES = 20;
const ISSUE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JIRA_CONNECTION_TOKEN_PREFIX = 'jira-connection:';
const JIRA_ISSUE_REF_PREFIX = 'jira-issue:';
const JIRA_SOURCE_PREFIX = 'jira-project:';

const STATE_TYPE_TO_CATEGORY: Record<'unstarted' | 'started' | 'completed', string> = {
  unstarted: 'new',
  started: 'indeterminate',
  completed: 'done',
};

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
  readonly id = 'jira';
  readonly #client: PlatformApiClient;
  readonly #endpointHost: string;
  readonly #siteUrlByConnectionId = new Map<string, string>();
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;
  readonly #orgIdByResourceId = new Map<string, string | null>();

  constructor(config: { client?: PlatformApiClient; endpointHost?: string } = {}) {
    if (config.client) {
      this.#client = config.client;
      this.#endpointHost = config.endpointHost ?? 'configured-client';
      return;
    }
    const platformConfig = platformIntegrationsApiClientConfigFromEnv();
    this.#client = new PlatformApiClient(platformConfig);
    this.#endpointHost = new URL(platformConfig.baseUrl).host;
  }

  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
  }

  get projects(): FactoryProjectsStorage {
    if (!this.#projects)
      throw new Error('JiraIntegration is not initialized — the factory binds storage during prepare().');
    return this.#projects;
  }

  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
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
    this.#siteUrlByConnectionId.clear();
  }

  async listConnections(): Promise<PlatformIntegrationConnection[]> {
    const result = await this.#client.request<{ connections: PlatformIntegrationConnection[] }>(
      'GET',
      '/v2/connections',
    );
    return result.connections.filter(connection => connection.integrationId === 'jira');
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.#activeConnections()).length > 0;
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

  async #resolveIntakeDispatch({ externalSource }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (externalSource.type !== 'issue') return null;
    const reference = decodeIssueReference(externalSource.externalId);
    if (!reference) return null;
    return {
      connection: jiraConnection(reference.connectionId),
      ...(reference.projectId ? { sourceId: encodeSourceId(reference.connectionId, reference.projectId) } : {}),
      issueId: reference.issueId,
    };
  }

  async #listSources(): Promise<IntakeSource[]> {
    const sources: IntakeSource[] = [];
    for (const connection of await this.#activeConnections()) {
      const context = await this.#connectionContext(connection);
      let startAt = 0;
      for (;;) {
        const page = await context.api.listProjects({ startAt });
        for (const project of page.values) {
          sources.push({
            id: encodeSourceId(connection.id, project.id),
            name: project.name,
            type: 'project',
            metadata: {
              key: project.key,
              connectionId: connection.id,
              site: new URL(context.siteUrl).host,
            },
          });
        }
        if (page.isLast || page.values.length === 0) break;
        startAt += page.values.length;
      }
    }
    return sources;
  }

  async #listItems({ sourceIds, cursor }: ListIntakeItemsInput): Promise<IntakeItemPage> {
    if (sourceIds.length === 0) return { items: [], nextCursor: null };
    const page = await this.listActiveIssues(cursor, sourceIds);
    return {
      items: page.issues.map(issue => ({
        source: { type: 'issue', externalId: issue.externalId, url: issue.url },
        sourceId: issue.sourceId,
        title: `${issue.identifier}: ${issue.title}`,
        status: issue.state ?? undefined,
        labels: issue.labels,
        assignee: issue.assignee,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        metadata: {
          identifier: issue.identifier,
          issueRef: issue.externalId,
          stateType: issue.stateType,
          priority: issue.priority,
          project: issue.source,
          site: issue.site,
        },
      })),
      nextCursor: page.nextCursor,
    };
  }

  async #listIssues(input: ListIntakeIssuesInput): Promise<{ issues: IntakeIssue[]; nextCursor: string | null }> {
    const page = await this.listActiveIssues(input.cursor, input.sourceIds, input.labels);
    return { issues: page.issues, nextCursor: page.nextCursor };
  }

  async listActiveIssues(
    cursor?: string,
    sourceIds: string[] = [],
    labels?: string[],
  ): Promise<{
    issues: Array<IntakeIssue & { sourceId: string; externalId: string; site: string }>;
    nextCursor: string | null;
  }> {
    const grouped = groupSources(sourceIds);
    if (grouped.length === 0) return { issues: [], nextCursor: null };
    const decodedCursor = decodePageCursor(cursor);
    if (decodedCursor.group >= grouped.length) return { issues: [], nextCursor: null };

    for (let groupIndex = decodedCursor.group; groupIndex < grouped.length; groupIndex++) {
      const group = grouped[groupIndex]!;
      const context = await this.#connectionContextById(group.connectionId);
      const jql = buildIntakeJql(group.projectIds, labels);
      if (jql === null) continue;
      const page = await context.api.searchIssues({
        jql,
        ...(groupIndex === decodedCursor.group && decodedCursor.jira ? { nextPageToken: decodedCursor.jira } : {}),
      });
      const nextCursor = page.nextPageToken
        ? encodePageCursor({ group: groupIndex, jira: page.nextPageToken })
        : groupIndex + 1 < grouped.length
          ? encodePageCursor({ group: groupIndex + 1 })
          : null;
      return {
        issues: page.issues.map(issue => {
          const projectId = issue.fields.project?.id ?? group.projectIds[0] ?? '';
          return {
            ...this.#toIntakeIssue(issue, context.siteUrl),
            sourceId: encodeSourceId(group.connectionId, projectId),
            externalId: encodeIssueReference({ connectionId: group.connectionId, issueId: issue.key, projectId }),
            site: new URL(context.siteUrl).host,
          };
        }),
        nextCursor,
      };
    }
    return { issues: [], nextCursor: null };
  }

  async #getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const resolved = await this.#resolveRequest(input);
    let issue: JiraIssue;
    try {
      issue = await resolved.context.api.getIssue(resolved.issueId);
    } catch (error) {
      if (error instanceof JiraApiError && error.status === 404) return null;
      throw error;
    }
    const { comments, total } = await this.#listAllComments(resolved.context.api, issue.key);
    return {
      ...this.#toIntakeIssue(issue, resolved.context.siteUrl),
      commentCount: total,
      description: issue.fields.description ? adfToText(issue.fields.description) || null : null,
      comments: comments.map(comment => ({
        author: comment.author?.displayName ?? null,
        body: adfToText(comment.body),
        createdAt: comment.created,
      })),
    };
  }

  async #listAllComments(api: JiraApiClient, keyOrId: string): Promise<{ comments: JiraComment[]; total: number }> {
    const comments: JiraComment[] = [];
    let total = 0;
    for (let page = 0; page < ISSUE_COMMENTS_MAX_PAGES; page++) {
      const result = await api.listComments(keyOrId, { startAt: comments.length });
      comments.push(...result.comments);
      total = result.total;
      if (result.comments.length === 0 || comments.length >= total) break;
    }
    return { comments, total };
  }

  async #createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
    const resolved = await this.#resolveRequest(input);
    let key = resolved.issueId;
    if (!ISSUE_KEY_PATTERN.test(key)) {
      try {
        key = (await resolved.context.api.getIssue(key)).key;
      } catch (error) {
        if (error instanceof JiraApiError && error.status === 404) return null;
        throw error;
      }
    }
    const comment = await resolved.context.api.createComment(key, input.body);
    return {
      id: comment.id,
      url: `${resolved.context.siteUrl}/browse/${key}?focusedCommentId=${comment.id}`,
    };
  }

  async #updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    const resolved = await this.#resolveRequest(input);
    let issue: JiraIssue;
    try {
      issue = await resolved.context.api.getIssue(resolved.issueId);
    } catch (error) {
      if (error instanceof JiraApiError && error.status === 404) return null;
      throw error;
    }
    if (currentStatusMatches(issue, input.state)) return this.#toIntakeIssue(issue, resolved.context.siteUrl);
    const transitions = await resolved.context.api.listTransitions(issue.key);
    const transition = resolveTransition(transitions, input.state);
    if (!transition) return null;
    await resolved.context.api.applyTransition(issue.key, transition.id);
    return this.#toIntakeIssue(await resolved.context.api.getIssue(issue.key), resolved.context.siteUrl);
  }

  async #resolveRequest(input: GetIntakeIssueInput): Promise<{ context: JiraConnectionContext; issueId: string }> {
    const issueReference = decodeIssueReference(input.issueId);
    const source = input.sourceId ? decodeSourceId(input.sourceId) : null;
    const connectionId =
      issueReference?.connectionId ?? source?.connectionId ?? connectionIdFromConnection(input.connection);
    const issueId = issueReference?.issueId ?? input.issueId;
    if (connectionId) return { context: await this.#connectionContextById(connectionId), issueId };
    const active = await this.#activeConnections();
    if (active.length !== 1) {
      throw new JiraApiError('Jira issue reference must identify a connection when multiple sites are connected.', 400);
    }
    return { context: await this.#connectionContext(active[0]!), issueId };
  }

  #toIntakeIssue(issue: JiraIssue, siteUrl: string): IntakeIssue {
    const { fields } = issue;
    return {
      id: issue.id,
      identifier: issue.key,
      title: fields.summary ?? issue.key,
      url: `${siteUrl}/browse/${issue.key}`,
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

  async #activeConnections(): Promise<PlatformIntegrationConnection[]> {
    return (await this.listConnections()).filter(connection => connection.status === 'active');
  }

  async #connectionContextById(connectionId: string): Promise<JiraConnectionContext> {
    const connection = (await this.#activeConnections()).find(candidate => candidate.id === connectionId);
    if (!connection) throw new JiraApiError('Jira connection is unavailable or requires reauthentication.', 401);
    return this.#connectionContext(connection);
  }

  async #connectionContext(connection: PlatformIntegrationConnection): Promise<JiraConnectionContext> {
    const api = new JiraApiClient({ client: this.#client, connectionId: connection.id });
    let siteUrl = this.#siteUrlByConnectionId.get(connection.id);
    if (!siteUrl) {
      siteUrl = connection.accountLabel
        ? normalizeSiteUrl(connection.accountLabel)
        : normalizeSiteUrl((await api.getServerInfo()).baseUrl);
      this.#siteUrlByConnectionId.set(connection.id, siteUrl);
    }
    return { connection, api, siteUrl };
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    return buildJiraRoutes({
      jira: this,
      auth: ctx.auth,
      intake: ctx.storage.intake,
      projects: ctx.storage.projects,
      appDbConfigured: Boolean(ctx.factoryStorage),
    });
  }

  async agentTools(args: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildJiraAgentTools({ requestContext: args.requestContext, jira: this });
  }

  diagnostics(): Record<string, unknown> {
    return { configured: true, mode: 'platform', endpointHost: this.#endpointHost };
  }
}

function jiraConnection(connectionId: string): IntegrationConnection {
  return { type: 'oauth', accessToken: `${JIRA_CONNECTION_TOKEN_PREFIX}${connectionId}` };
}

function connectionIdFromConnection(connection: IntegrationConnection): string | null {
  if (connection.type !== 'oauth' || !connection.accessToken.startsWith(JIRA_CONNECTION_TOKEN_PREFIX)) return null;
  return connection.accessToken.slice(JIRA_CONNECTION_TOKEN_PREFIX.length) || null;
}

export function encodeSourceId(connectionId: string, projectId: string): string {
  return `${JIRA_SOURCE_PREFIX}${Buffer.from(JSON.stringify({ connectionId, projectId })).toString('base64url')}`;
}

export function decodeSourceId(sourceId: string): { connectionId: string; projectId: string } | null {
  if (!sourceId.startsWith(JIRA_SOURCE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(sourceId.slice(JIRA_SOURCE_PREFIX.length), 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    return typeof parsed.connectionId === 'string' && typeof parsed.projectId === 'string'
      ? { connectionId: parsed.connectionId, projectId: parsed.projectId }
      : null;
  } catch {
    return null;
  }
}

export function encodeIssueReference(reference: JiraIssueReference): string {
  return `${JIRA_ISSUE_REF_PREFIX}${Buffer.from(JSON.stringify(reference)).toString('base64url')}`;
}

export function decodeIssueReference(value: string): JiraIssueReference | null {
  if (!value.startsWith(JIRA_ISSUE_REF_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value.slice(JIRA_ISSUE_REF_PREFIX.length), 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    if (typeof parsed.connectionId !== 'string' || typeof parsed.issueId !== 'string') return null;
    return {
      connectionId: parsed.connectionId,
      issueId: parsed.issueId,
      ...(typeof parsed.projectId === 'string' ? { projectId: parsed.projectId } : {}),
    };
  } catch {
    return null;
  }
}

function groupSources(sourceIds: string[]): Array<{ connectionId: string; projectIds: string[] }> {
  const groups = new Map<string, Set<string>>();
  for (const sourceId of sourceIds) {
    const source = decodeSourceId(sourceId);
    if (!source) continue;
    const projectIds = groups.get(source.connectionId) ?? new Set<string>();
    projectIds.add(source.projectId);
    groups.set(source.connectionId, projectIds);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([connectionId, projectIds]) => ({ connectionId, projectIds: [...projectIds].sort() }));
}

function encodePageCursor(cursor: JiraPageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodePageCursor(cursor: string | undefined): JiraPageCursor {
  if (!cursor) return { group: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (!Number.isInteger(parsed.group) || (parsed.group as number) < 0) throw new Error();
    return {
      group: parsed.group as number,
      ...(typeof parsed.jira === 'string' ? { jira: parsed.jira } : {}),
    };
  } catch {
    throw new JiraApiError('Jira pagination cursor is invalid.', 400);
  }
}

function normalizeSiteUrl(value: string): string {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new JiraApiError('Jira site URL is invalid.', 502);
  return url.origin;
}

function buildIntakeJql(projectIds?: string[], labels?: string[]): string | null {
  const clauses: string[] = [];
  const safeProjects = (projectIds ?? [])
    .map(id => id.trim())
    .filter(id => /^[A-Za-z0-9_]+$/.test(id))
    .map(id => (/^\d+$/.test(id) ? id : `"${id}"`));
  if (projectIds && safeProjects.length === 0) return null;
  if (safeProjects.length > 0) clauses.push(`project IN (${safeProjects.join(', ')})`);
  clauses.push('statusCategory != Done');
  const safeLabels = [...new Set((labels ?? []).map(label => label.trim().replace(/["\\]/g, '')).filter(Boolean))];
  if (safeLabels.length > 0) clauses.push(`labels IN (${safeLabels.map(label => `"${label}"`).join(', ')})`);
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}

function currentStatusMatches(issue: JiraIssue, target: UpdateIntakeIssueInput['state']): boolean {
  const status = issue.fields.status;
  if (!status) return false;
  if (target.kind === 'byName') return status.name.toLowerCase() === target.name.toLowerCase();
  if (target.stateType === 'canceled') return status.statusCategory?.key === 'done' && /cancel/i.test(status.name);
  return status.statusCategory?.key === STATE_TYPE_TO_CATEGORY[target.stateType];
}

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
