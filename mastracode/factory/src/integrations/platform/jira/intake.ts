import type {
  CreateIntakeCommentInput,
  CreatedIntakeComment,
  GetIntakeIssueInput,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeItemPage,
  IntakeSource,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ListIntakeSourcesInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../../capabilities/intake.js';
import { adfToText } from '../../jira/adf.js';
import type { JiraComment, JiraIssue, JiraTransition } from '../../jira/api.js';
import { JiraApiClient, JiraApiError } from '../../jira/api.js';
import { buildIntakeJql, unfilteredJiraScopes } from '../../jira/intake-jql.js';
import type { JiraIntakeScope } from '../../jira/intake-jql.js';
import type { PlatformConnection } from '../foundation/connect-binding.js';
import { PlatformIntakeCapability } from '../foundation/intake.js';
import { CONNECT_PROXY_TOKEN } from '../platform-connect.js';
import type { PlatformJiraIntegration } from './integration.js';

interface JiraConnectionContext {
  connection: PlatformConnection;
  api: JiraApiClient;
  siteUrl: string;
}

export interface JiraIssueReference {
  connectionId: string;
  issueId: string;
  projectId?: string;
}

interface JiraPageCursor {
  group: number;
  jira?: string;
}

const ISSUE_COMMENTS_MAX_PAGES = 20;

/** Hard stop for project pagination so a misbehaving `isLast` can't loop forever. */
const PROJECT_SEARCH_MAX_PAGES = 50;
const ISSUE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const JIRA_CONNECTION_TOKEN_PREFIX = 'jira-connection:';
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

/** One page of active Jira issues across connections. */
export interface JiraActiveIssuePage {
  issues: Array<IntakeIssue & { sourceId: string; externalId: string; site: string }>;
  nextCursor: string | null;
}

/** The Platform Jira intake: Jira projects as sources, reached through each connection's proxy. */
export class PlatformJiraIntake extends PlatformIntakeCapability {
  readonly bindingLabelFilters = true;
  readonly #jira: PlatformJiraIntegration;
  readonly #cloudIdByConnectionId = new Map<string, string>();
  readonly #siteUrlByConnectionId = new Map<string, string>();

  constructor(jira: PlatformJiraIntegration) {
    super(jira, JIRA_CONNECTION_TOKEN_PREFIX);
    this.#jira = jira;
  }

  clearCaches(): void {
    this.#cloudIdByConnectionId.clear();
    this.#siteUrlByConnectionId.clear();
  }

  async resolveIntakeDispatch({ externalSource }: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (externalSource.type !== 'issue') return null;
    const reference = decodeIssueReference(externalSource.externalId);
    if (!reference) return null;
    return {
      connection: this.connectionCredential(reference.connectionId),
      ...(reference.projectId ? { sourceId: encodeSourceId(reference.connectionId, reference.projectId) } : {}),
      issueId: reference.issueId,
    };
  }

  async listSources(_input: ListIntakeSourcesInput): Promise<IntakeSource[]> {
    const sources: IntakeSource[] = [];
    for (const connection of await this.#activeConnections()) {
      const context = await this.#connectionContext(connection);
      let startAt = 0;
      for (let pageCount = 0; pageCount < PROJECT_SEARCH_MAX_PAGES; pageCount++) {
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

  async listItems({ sourceIds, cursor }: ListIntakeItemsInput): Promise<IntakeItemPage> {
    if (sourceIds.length === 0) return { items: [], nextCursor: null };
    const page = await this.#jira.listActiveIssues(cursor, unfilteredJiraScopes(sourceIds));
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
          state: issue.state,
          stateType: issue.stateType,
          priority: issue.priority,
          project: issue.source,
          site: issue.site,
          assignee: issue.assignee,
          assignees: issue.assignees ?? [],
          creator: issue.author,
          author: issue.author,
          labels: issue.labels,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        },
      })),
      nextCursor: page.nextCursor,
    };
  }

  async listIssues(input: ListIntakeIssuesInput): Promise<{ issues: IntakeIssue[]; nextCursor: string | null }> {
    const page = await this.#jira.listActiveIssues(
      input.cursor,
      unfilteredJiraScopes(input.sourceIds ?? []),
      input.labels,
    );
    return { issues: page.issues, nextCursor: page.nextCursor };
  }

  /**
   * One page of active issues across connections. Each scope's `projectId` is
   * an encoded Platform source id; sources are grouped per connection and each
   * group runs one JQL built from only that connection's projects.
   */
  async listActiveIssues(
    cursor?: string,
    scopes: JiraIntakeScope[] = [],
    labels?: string[],
  ): Promise<{
    issues: Array<IntakeIssue & { sourceId: string; externalId: string; site: string }>;
    nextCursor: string | null;
  }> {
    const grouped = groupSources(scopes);
    if (grouped.length === 0) return { issues: [], nextCursor: null };
    const decodedCursor = decodePageCursor(cursor);
    if (decodedCursor.group >= grouped.length) return { issues: [], nextCursor: null };

    for (let groupIndex = decodedCursor.group; groupIndex < grouped.length; groupIndex++) {
      const group = grouped[groupIndex]!;
      const context = await this.#connectionContextById(group.connectionId);
      const jql = buildIntakeJql(group.scopes, labels);
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
          const projectId = issue.fields.project?.id ?? group.scopes[0]?.projectId ?? '';
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

  async getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const { context, issue } = (await this.#findIssue(input)) ?? {};
    if (!context || !issue) return null;
    const { comments, total } = await this.#listAllComments(context.api, issue.key);
    return {
      ...this.#toIntakeIssue(issue, context.siteUrl),
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

  async createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
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
    let comment;
    try {
      comment = await resolved.context.api.createComment(key, input.body);
    } catch (error) {
      if (error instanceof JiraApiError && error.status === 404) return null;
      throw error;
    }
    return {
      id: comment.id,
      url: `${resolved.context.siteUrl}/browse/${key}?focusedCommentId=${comment.id}`,
    };
  }

  async updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
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
    const connectionId = issueReference?.connectionId ?? source?.connectionId ?? this.connectionIdOf(input.connection);
    const issueId = issueReference?.issueId ?? input.issueId;
    if (connectionId) return { context: await this.#connectionContextById(connectionId), issueId };
    const active = await this.#activeConnections();
    if (active.length !== 1) {
      throw new JiraApiError('Jira issue reference must identify a connection when multiple sites are connected.', 400);
    }
    return { context: await this.#connectionContext(active[0]!), issueId };
  }

  /**
   * Locate an issue for a read. A connection-scoped reference resolves
   * directly; a plain issue key (the agent tool's normal input) is looked up
   * across every active connection so multi-site organizations can still
   * fetch by key — the first site that knows the key wins, which is safe
   * because Jira project-key prefixes make cross-site collisions unlikely and
   * the tool is read-only.
   */
  async #findIssue(input: GetIntakeIssueInput): Promise<{ context: JiraConnectionContext; issue: JiraIssue } | null> {
    const issueReference = decodeIssueReference(input.issueId);
    const source = input.sourceId ? decodeSourceId(input.sourceId) : null;
    // A reference that names a different connection or project than the source scope
    // cannot widen that scope.
    if (
      issueReference &&
      source &&
      (issueReference.connectionId !== source.connectionId ||
        (issueReference.projectId !== undefined && issueReference.projectId !== source.projectId))
    ) {
      return null;
    }
    const connectionId = issueReference?.connectionId ?? source?.connectionId ?? this.connectionIdOf(input.connection);
    const issueId = issueReference?.issueId ?? input.issueId;
    const projectId = issueReference?.projectId ?? source?.projectId;

    const candidates: JiraConnectionContext[] = [];
    if (connectionId) {
      candidates.push(await this.#connectionContextById(connectionId));
    } else {
      const active = await this.#activeConnections();
      if (active.length === 0) {
        throw new JiraApiError('Jira connection is unavailable or requires reauthentication.', 401);
      }
      for (const connection of active) candidates.push(await this.#connectionContext(connection));
    }

    let firstError: unknown;
    for (const context of candidates) {
      try {
        const issue = await context.api.getIssue(issueId);
        // A reference scoped to a project only resolves issues that live in that project.
        if (projectId && issue.fields.project?.id !== projectId) return null;
        return { context, issue };
      } catch (error) {
        if (error instanceof JiraApiError && error.status === 404) continue;
        firstError ??= error;
      }
    }
    // Not found anywhere. If a site failed for a non-404 reason, surface that
    // failure instead of a silent "not found".
    if (firstError !== undefined) throw firstError;
    return null;
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

  async #activeConnections(): Promise<PlatformConnection[]> {
    return (await this.#jira.listConnections()).filter(connection => connection.status === 'active');
  }

  async #connectionContextById(connectionId: string): Promise<JiraConnectionContext> {
    return this.#connectionContext(await this.activeConnectionById(connectionId));
  }

  protected notConnectedError(): JiraApiError {
    return new JiraApiError('Jira connection is unavailable or requires reauthentication.', 401);
  }

  async #cloudId(connectionId: string): Promise<string> {
    const cached = this.#cloudIdByConnectionId.get(connectionId);
    if (cached) return cached;

    const context = await this.#jira.connect.getContext(connectionId);
    const cloudId = context.connection_config?.cloudId;
    if (typeof cloudId !== 'string' || !UUID_PATTERN.test(cloudId)) {
      throw new JiraApiError('Platform Jira connection context is missing a valid cloudId.', 502);
    }
    this.#cloudIdByConnectionId.set(connectionId, cloudId);
    return cloudId;
  }

  async #connectionContext(connection: PlatformConnection): Promise<JiraConnectionContext> {
    const proxyBaseUrl = this.#jira.binding.proxyBaseUrl(connection.id);
    const cloudId = await this.#cloudId(connection.id);
    const api = new JiraApiClient({
      baseUrl: `${proxyBaseUrl}/ex/jira/${encodeURIComponent(cloudId)}`,
      accessToken: CONNECT_PROXY_TOKEN,
      fetchImpl: this.#jira.binding.proxyFetch(),
    });
    let siteUrl = this.#siteUrlByConnectionId.get(connection.id);
    if (!siteUrl) {
      siteUrl = connection.accountLabel
        ? normalizeSiteUrl(connection.accountLabel)
        : normalizeSiteUrl((await api.getServerInfo()).baseUrl);
      this.#siteUrlByConnectionId.set(connection.id, siteUrl);
    }
    return { connection, api, siteUrl };
  }
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

/** A Platform source scope: `projectId` is the encoded source id, decoded per connection here. */
function groupSources(scopes: JiraIntakeScope[]): Array<{ connectionId: string; scopes: JiraIntakeScope[] }> {
  const groups = new Map<string, Map<string, JiraIntakeScope>>();
  for (const scope of scopes) {
    const source = decodeSourceId(scope.projectId);
    if (!source) continue;
    const projects = groups.get(source.connectionId) ?? new Map<string, JiraIntakeScope>();
    if (!projects.has(source.projectId)) projects.set(source.projectId, { ...scope, projectId: source.projectId });
    groups.set(source.connectionId, projects);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([connectionId, projects]) => ({
      connectionId,
      scopes: [...projects.values()].sort((left, right) => left.projectId.localeCompare(right.projectId)),
    }));
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
  // `accountLabel` is free-form Platform data — an unparsable value must
  // surface as the classified 502 the routes already handle, not a raw
  // TypeError escaping the connection context.
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new JiraApiError('Jira site URL is invalid.', 502);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new JiraApiError('Jira site URL is invalid.', 502);
  return url.origin;
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
