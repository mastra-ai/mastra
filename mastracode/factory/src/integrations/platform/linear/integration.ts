import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type { Intake, IntakeIssue, IntakeIssueDetail } from '../../../capabilities/intake.js';
import type { RouteAuth } from '../../../routes/route.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import type { FactoryIntegration, IntegrationContext, IntegrationTools, LinearIssueIngress } from '../../base.js';
import { buildLinearAgentTools } from '../../linear/agent-tools.js';
import type { LinearConnectionCheck, LinearIntegration } from '../../linear/integration.js';
import { buildLinearRoutes } from '../../linear/routes.js';
import type { LinearConnectionData, LinearConnectionRow, LinearStorageHandle } from '../../linear/storage.js';
import { logPlatformInfo, PlatformApiClient, PlatformApiError, platformApiClientConfigFromEnv } from '../api-client.js';
import { PlatformLinearEventWorker } from './event-worker.js';
import type { PlatformLinearEventStorage } from './event-worker.js';
import { decodeSourceId, encodeSourceId } from './source-id.js';

type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type LinearUser = {
  id: string;
  name: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};
type LinearIssue = {
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
  assignee: LinearUser | null;
  creator: LinearUser | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
type LinearComment = {
  id: string;
  body: string;
  url: string;
  issue: { id: string; identifier: string };
  user: LinearUser | null;
  parent: { id: string } | null;
  createdAt: string;
  updatedAt: string;
};
type LinearWorkspace = {
  linearWorkspaceId: string;
  linearWorkspaceName: string;
  urlKey: string | null;
  connected: boolean;
};
type LinearProject = {
  id: string;
  name: string;
  state: string;
  teams: Array<{ id: string; key: string; name: string }>;
};
type ProjectSource = { workspace: LinearWorkspace; project: LinearProject };

const API_PREFIX = '/v1/server/linear';
const PAGE_SIZE = 30;
const MAX_REFERENCE_PAGES = 20;
const MAX_COMMENT_PAGES = 20;
const PLATFORM_MANAGED_CONNECTION_TOKEN = 'platform-managed';

function loose(c: unknown): Context {
  return c as Context;
}

function routeBaseUrl(ctx: IntegrationContext, requestUrl: string): string {
  return (ctx.baseUrl || new URL(requestUrl).origin).replace(/\/+$/, '');
}

export class PlatformLinearIntegration implements FactoryIntegration {
  readonly id = 'linear';
  readonly #client: PlatformApiClient;
  readonly #endpointHost: string;
  readonly #pollingEnabled: boolean;
  readonly #pollingIntervalMs: number | undefined;
  #projects: FactoryProjectsStorage | undefined;
  #auth: RouteAuth | undefined;

  readonly intake: Intake = {
    listSources: async () => {
      const sources = await this.#listProjectSources();
      return sources.map(({ workspace, project }) => ({
        id: encodeSourceId(workspace.linearWorkspaceId, project.id),
        name: project.name,
        type: 'project',
        metadata: {
          workspaceId: workspace.linearWorkspaceId,
          workspaceName: workspace.linearWorkspaceName,
          workspaceUrlKey: workspace.urlKey,
          state: project.state,
          teams: project.teams,
        },
      }));
    },
    listItems: async ({ sourceIds, cursor }) => {
      const result = await this.#listIssues(sourceIds, cursor);
      return {
        items: result.issues.map(({ issue, source }) => ({
          source: { type: 'issue', externalId: issue.id, url: issue.url },
          sourceId: encodeSourceId(source.workspace.linearWorkspaceId, source.project.id),
          title: issue.title,
          status: issue.state.name,
          labels: issue.labels.map(label => label.name),
          assignee: issue.assignee?.displayName ?? issue.assignee?.name ?? null,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          metadata: {
            identifier: issue.identifier,
            workspaceId: source.workspace.linearWorkspaceId,
            workspaceName: source.workspace.linearWorkspaceName,
            projectId: source.project.id,
            projectName: source.project.name,
            team: issue.team.key,
            priority: issue.priorityLabel,
          },
        })),
        nextCursor: result.nextCursor,
      };
    },
    listIssues: async ({ connection, sourceIds, labels, cursor }) => {
      requireLinearConnection(connection);
      const result = await this.#listIssues(sourceIds, cursor, labels);
      return {
        issues: result.issues.map(({ issue }) => parseIssue(issue)),
        nextCursor: result.nextCursor,
      };
    },
    getIssue: async ({ connection, sourceId, issueId }) => {
      requireLinearConnection(connection);
      const located = await this.#findIssue(sourceId, issueId);
      if (!located) return null;
      const comments = await this.#loadComments(located.workspaceId, issueId, located.issue.comments);
      return parseIssueDetail(located.issue, comments);
    },
    createComment: async ({ connection, sourceId, issueId, body }) => {
      requireLinearConnection(connection);
      const workspaceId = await this.#resolveWorkspaceForIssue(sourceId, issueId);
      if (!workspaceId) return null;
      try {
        const comment = await this.#client.request<LinearComment>(
          'POST',
          `${API_PREFIX}/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/comments`,
          { body },
        );
        return { id: comment.id, url: comment.url };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  };

  constructor() {
    const config = platformApiClientConfigFromEnv();
    this.#client = new PlatformApiClient(config);
    this.#endpointHost = new URL(config.baseUrl).host;
    this.#pollingEnabled = process.env.MASTRA_PLATFORM_LINEAR_POLLING_ENABLED?.trim().toLowerCase() !== 'false';
    this.#pollingIntervalMs = optionalPositiveIntegerEnv('MASTRA_PLATFORM_LINEAR_POLLING_INTERVAL_MS');
  }

  get storage(): LinearStorageHandle {
    const now = new Date();
    return {
      integrationId: this.id,
      connections: {
        get: async (orgId: string) => ({
          id: `platform-linear:${orgId}`,
          orgId,
          userId: null,
          data: {
            accessToken: PLATFORM_MANAGED_CONNECTION_TOKEN,
            refreshToken: null,
            expiresAtMs: null,
            scope: 'read,comments:create',
            workspaceName: null,
            workspaceUrlKey: null,
          } satisfies LinearConnectionData,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        }),
      },
    } as unknown as LinearStorageHandle;
  }

  get projects(): FactoryProjectsStorage {
    if (!this.#projects) throw new Error('PlatformLinearIntegration projects storage has not been initialized.');
    return this.#projects;
  }

  initialize({ projects, auth }: { projects: FactoryProjectsStorage; auth?: RouteAuth }): void {
    this.#projects = projects;
    this.#auth = auth;
    logPlatformInfo('Platform Linear integration initialized', { endpointHost: this.#endpointHost });
  }

  get authEnabled(): boolean {
    return this.#auth?.enabled() ?? false;
  }

  async resolveOrgId(resourceId: string): Promise<string | null> {
    try {
      const project = await this.projects.getById({ id: resourceId });
      return project?.orgId ?? null;
    } catch {
      return null;
    }
  }

  async loadConnection(orgId: string): Promise<LinearConnectionRow | null> {
    const workspace = (await this.#listWorkspaces())[0];
    if (!workspace) return null;
    const now = new Date();
    return {
      id: `platform-linear:${orgId}`,
      orgId,
      userId: null,
      accessToken: PLATFORM_MANAGED_CONNECTION_TOKEN,
      scope: 'read,comments:create',
      refreshToken: null,
      expiresAt: null,
      workspaceName: workspace.linearWorkspaceName,
      workspaceUrlKey: workspace.urlKey,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getFreshAccessToken(_connection: LinearConnectionRow): Promise<string> {
    return PLATFORM_MANAGED_CONNECTION_TOKEN;
  }

  canPostComments(connection: LinearConnectionRow): boolean {
    const scopes = (connection.scope ?? '').split(/[\s,]+/).filter(Boolean);
    return scopes.some(scope => scope === 'comments:create' || scope === 'write' || scope === 'admin');
  }

  async checkConnection(orgId: string): Promise<LinearConnectionCheck> {
    const connection = await this.loadConnection(orgId);
    return {
      connected: connection !== null,
      canComment: connection !== null && this.canPostComments(connection),
      checkedAt: Date.now(),
    };
  }

  routes(ctx: IntegrationContext): ApiRoute[] {
    return [
      this.#connectRoute(ctx),
      ...buildLinearRoutes({
        auth: ctx.auth,
        linear: this as unknown as LinearIntegration,
        stateSigner: ctx.stateSigner,
        baseUrl: ctx.baseUrl,
        intake: ctx.storage.intake,
      }).filter(route => !route.path.startsWith('/auth/linear/')),
    ];
  }

  #connectRoute(ctx: IntegrationContext): ApiRoute {
    return registerApiRoute('/auth/linear/connect', {
      method: 'GET',
      requiresAuth: false,
      handler: async c => {
        await ctx.auth.ensureUser(loose(c));
        const tenant = ctx.auth.tenant(loose(c));
        if (!tenant?.orgId) return c.json({ error: 'unauthorized' }, 401);

        const returnTo = c.req.query('return_to') || '/';
        const originator = routeBaseUrl(ctx, c.req.url);
        logPlatformInfo('Starting Platform Linear connect flow', {
          orgId: tenant.orgId,
          returnTo,
          originator,
        });
        const query = new URLSearchParams({ return_to: returnTo, originator });
        const location = await this.#client.requestRedirect('GET', `${API_PREFIX}/authorize?${query}`);
        return c.redirect(location);
      },
    });
  }

  workers(ctx: IntegrationContext): PlatformLinearEventWorker[] {
    if (!this.#pollingEnabled || !ctx.hooks?.ingestLinearIssues) return [];
    return [
      new PlatformLinearEventWorker({
        client: this.#client,
        intake: ctx.storage.intake,
        projects: ctx.storage.projects,
        storage: ctx.storage.generic as unknown as PlatformLinearEventStorage,
        loadIssue: (workspaceId, issueId) => this.#loadIssueForEvent(workspaceId, issueId),
        ingestLinearIssues: ctx.hooks.ingestLinearIssues,
        intervalMs: this.#pollingIntervalMs,
      }),
    ];
  }

  async agentTools({ requestContext }: { requestContext: RequestContext }): Promise<IntegrationTools> {
    return buildLinearAgentTools({ requestContext, linear: this as unknown as LinearIntegration });
  }

  diagnostics(): Record<string, unknown> {
    return { mode: 'platform', endpointHost: this.#endpointHost };
  }

  async listProjects(): Promise<Array<LinearProject & { workspaceId: string }>> {
    return (await this.#listProjectSources()).map(({ workspace, project }) => ({
      ...project,
      id: encodeSourceId(workspace.linearWorkspaceId, project.id),
      workspaceId: workspace.linearWorkspaceId,
    }));
  }

  async #loadIssueForEvent(workspaceId: string, issueId: string): Promise<LinearIssueIngress | null> {
    try {
      const issue = await this.#client.request<LinearIssue>(
        'GET',
        `${API_PREFIX}/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}`,
      );
      return parseIssueIngress(issue);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async #listProjectSources(): Promise<ProjectSource[]> {
    const workspaces = await this.#listWorkspaces();
    const projectGroups = await Promise.all(
      workspaces.map(async workspace => {
        const projects: LinearProject[] = [];
        let after: string | undefined;
        for (let page = 0; page < MAX_REFERENCE_PAGES; page += 1) {
          const query = new URLSearchParams({ first: '200' });
          if (after) query.set('after', after);
          const result = await this.#client.request<{ projects: LinearProject[]; pageInfo: PageInfo }>(
            'GET',
            `${API_PREFIX}/workspaces/${encodeURIComponent(workspace.linearWorkspaceId)}/projects?${query}`,
          );
          projects.push(...result.projects);
          if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
          after = result.pageInfo.endCursor;
        }
        return projects.map(project => ({ workspace, project }));
      }),
    );
    return projectGroups.flat();
  }

  async #listWorkspaces(): Promise<LinearWorkspace[]> {
    const result = await this.#client.request<{ workspaces: LinearWorkspace[] }>('GET', `${API_PREFIX}/workspaces`);
    return result.workspaces.filter(workspace => workspace.connected);
  }

  async #listIssues(sourceIds: string[], cursor?: string, labels?: string[]) {
    if (sourceIds.length === 0)
      return { issues: [] as Array<{ issue: LinearIssue; source: ProjectSource }>, nextCursor: null };
    const sources = await this.#listProjectSources();
    const sourceMap = new Map(
      sources.map(source => [encodeSourceId(source.workspace.linearWorkspaceId, source.project.id), source]),
    );
    const selected = sourceIds
      .map(sourceId => sourceMap.get(sourceId))
      .filter((source): source is ProjectSource => !!source);
    const cursors = decodeCursor(cursor, sourceIds);
    const normalizedLabels = normalizeLabels(labels);
    const nextState: Record<string, string | null> = {};
    let hasNextPage = false;
    const pages = await Promise.all(
      selected.map(async source => {
        const sourceId = encodeSourceId(source.workspace.linearWorkspaceId, source.project.id);
        if (cursors[sourceId] === null) {
          nextState[sourceId] = null;
          return [] as Array<{ issue: LinearIssue; source: ProjectSource }>;
        }
        const query = new URLSearchParams({
          first: String(PAGE_SIZE),
          projectIds: source.project.id,
          stateType: 'triage,backlog,unstarted,started',
          orderBy: 'updatedAt',
        });
        const after = cursors[sourceId];
        if (after) query.set('after', after);
        const result = await this.#client.request<{ issues: LinearIssue[]; pageInfo: PageInfo }>(
          'GET',
          `${API_PREFIX}/workspaces/${encodeURIComponent(source.workspace.linearWorkspaceId)}/issues?${query}`,
        );
        const next = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
        nextState[sourceId] = next;
        hasNextPage ||= next !== null;
        return result.issues
          .filter(
            issue => normalizedLabels.length === 0 || issue.labels.some(label => normalizedLabels.includes(label.name)),
          )
          .map(issue => ({ issue, source }));
      }),
    );
    return {
      issues: pages.flat(),
      nextCursor: hasNextPage ? encodeCursor(nextState, sourceIds) : null,
    };
  }

  async #findIssue(
    sourceId: string | undefined,
    issueId: string,
  ): Promise<{
    workspaceId: string;
    issue: LinearIssue & { comments?: { nodes: LinearComment[]; pageInfo: PageInfo } };
  } | null> {
    const workspaceIds = await this.#candidateWorkspaceIds(sourceId);
    for (const workspaceId of workspaceIds) {
      try {
        const issue = await this.#client.request<
          LinearIssue & { comments?: { nodes: LinearComment[]; pageInfo: PageInfo } }
        >(
          'GET',
          `${API_PREFIX}/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}?include=comments`,
        );
        return { workspaceId, issue };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    return null;
  }

  async #resolveWorkspaceForIssue(sourceId: string | undefined, issueId: string): Promise<string | null> {
    const workspaceIds = await this.#candidateWorkspaceIds(sourceId);
    if (workspaceIds.length === 1) return workspaceIds[0]!;
    for (const workspaceId of workspaceIds) {
      try {
        await this.#client.request<LinearIssue>(
          'GET',
          `${API_PREFIX}/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}`,
        );
        return workspaceId;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    return null;
  }

  async #candidateWorkspaceIds(sourceId: string | undefined): Promise<string[]> {
    if (sourceId) return [decodeSourceId(sourceId).workspaceId];
    return (await this.#listWorkspaces()).map(workspace => workspace.linearWorkspaceId);
  }

  async #loadComments(
    workspaceId: string,
    issueId: string,
    embedded: { nodes: LinearComment[]; pageInfo: PageInfo } | undefined,
  ): Promise<LinearComment[]> {
    const comments = [...(embedded?.nodes ?? [])];
    let pageInfo = embedded?.pageInfo;
    let page = 0;
    while (pageInfo?.hasNextPage && pageInfo.endCursor && page < MAX_COMMENT_PAGES) {
      const result = await this.#client.request<{ comments: LinearComment[]; pageInfo: PageInfo }>(
        'GET',
        `${API_PREFIX}/workspaces/${encodeURIComponent(workspaceId)}/issues/${encodeURIComponent(issueId)}/comments?first=200&after=${encodeURIComponent(pageInfo.endCursor)}`,
      );
      comments.push(...result.comments);
      pageInfo = result.pageInfo;
      page += 1;
    }
    return comments;
  }
}

function parseIssue(issue: LinearIssue): IntakeIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    author: issue.creator?.displayName ?? issue.creator?.name ?? null,
    state: issue.state.name,
    stateType: issue.state.type,
    priority: issue.priorityLabel,
    assignee: issue.assignee?.displayName ?? issue.assignee?.name ?? null,
    source: issue.team.key,
    labels: issue.labels.map(label => label.name),
    commentCount: null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function parseIssueIngress(issue: LinearIssue): LinearIssueIngress {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
    state: issue.state.name,
    stateType: issue.state.type,
    priorityLabel: issue.priorityLabel,
    assignee: issue.assignee?.displayName ?? issue.assignee?.name ?? null,
    team: issue.team.key,
    labels: issue.labels.map(label => label.name),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function parseIssueDetail(issue: LinearIssue, comments: LinearComment[]): IntakeIssueDetail {
  return {
    ...parseIssue(issue),
    commentCount: comments.length,
    description: issue.description?.trim() ? issue.description : null,
    comments: comments.map(comment => ({
      author: comment.user?.displayName ?? comment.user?.name ?? null,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  };
}

function normalizeLabels(labels: string[] | undefined): string[] {
  return [...new Set((labels ?? []).map(label => label.trim()).filter(Boolean))];
}

function decodeCursor(cursor: string | undefined, sourceIds: string[]): Record<string, string | null | undefined> {
  if (!cursor) return {};
  if (sourceIds.length === 1) return { [sourceIds[0]!]: cursor };
  try {
    const parsed = JSON.parse(cursor) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, string | null>;
  } catch {
    throw new Error('Linear cursor is invalid.');
  }
}

function encodeCursor(state: Record<string, string | null>, sourceIds: string[]): string {
  if (sourceIds.length === 1) return state[sourceIds[0]!]!;
  return JSON.stringify(state);
}

function requireLinearConnection(connection: IntegrationConnection): void {
  if (connection.type !== 'oauth') {
    throw new Error('Linear capabilities require an OAuth connection.');
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof PlatformApiError && error.status === 404;
}

function optionalPositiveIntegerEnv(name: 'MASTRA_PLATFORM_LINEAR_POLLING_INTERVAL_MS'): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}
