import { PlatformApiClient, PlatformApiError } from '../platform/api-client.js';
import type { AdfNode } from './adf.js';
import { textToAdf } from './adf.js';

export const JIRA_ISSUES_PAGE_SIZE = 30;
export const JIRA_COMMENTS_PAGE_SIZE = 50;
export const JIRA_PROJECTS_PAGE_SIZE = 50;

export const JIRA_ISSUE_FIELDS = [
  'summary',
  'description',
  'status',
  'assignee',
  'reporter',
  'labels',
  'priority',
  'issuetype',
  'project',
  'created',
  'updated',
] as const;

export interface JiraApiClientConfig {
  client: PlatformApiClient;
  connectionId: string;
}

export type JiraApiErrorCode = 'jira_auth_failed' | 'jira_request_failed';

export class JiraApiError extends Error {
  readonly status: number | null;
  readonly code: JiraApiErrorCode;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'JiraApiError';
    this.status = status;
    this.code = status === 401 || status === 403 ? 'jira_auth_failed' : 'jira_request_failed';
  }
}

export interface JiraStatusCategory {
  key: string;
  name?: string;
}

export interface JiraStatus {
  name: string;
  statusCategory?: JiraStatusCategory;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraProjectSearchPage {
  values: JiraProject[];
  startAt: number;
  isLast: boolean;
}

export interface JiraServerInfo {
  baseUrl: string;
  serverTitle?: string;
}

export interface JiraUser {
  displayName: string;
}

export interface JiraComment {
  id: string;
  author?: JiraUser | null;
  body?: AdfNode | null;
  created: string;
}

export interface JiraCommentPage {
  comments: JiraComment[];
  startAt: number;
  maxResults: number;
  total: number;
}

export interface JiraIssueFields {
  summary?: string;
  description?: AdfNode | null;
  status?: JiraStatus;
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  labels?: string[];
  priority?: { name: string } | null;
  issuetype?: { name: string };
  project?: { id: string; key: string; name?: string };
  created?: string;
  updated?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

export interface JiraSearchPage {
  issues: JiraIssue[];
  nextPageToken?: string | null;
}

export interface JiraTransition {
  id: string;
  name: string;
  to?: JiraStatus;
}

export class JiraApiClient {
  readonly #client: PlatformApiClient;
  readonly #connectionId: string;

  constructor(config: JiraApiClientConfig) {
    if (!config.connectionId) throw new Error('JiraApiClient is missing required config: connectionId.');
    this.#client = config.client;
    this.#connectionId = config.connectionId;
  }

  async #request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const proxyPath = `/v2/connections/${encodeURIComponent(this.#connectionId)}/proxy${path}${suffix}`;
    try {
      return await this.#client.request<T>(method, proxyPath, options.body);
    } catch (error) {
      if (error instanceof PlatformApiError) throw new JiraApiError(error.message, error.status);
      throw new JiraApiError(error instanceof Error ? error.message : String(error), null);
    }
  }

  async getServerInfo(): Promise<JiraServerInfo> {
    return this.#request<JiraServerInfo>('GET', '/rest/api/3/serverInfo');
  }

  async listProjects(options: { startAt?: number } = {}): Promise<JiraProjectSearchPage> {
    return this.#request<JiraProjectSearchPage>('GET', '/rest/api/3/project/search', {
      query: { startAt: options.startAt ?? 0, maxResults: JIRA_PROJECTS_PAGE_SIZE },
    });
  }

  async searchIssues(options: {
    jql: string;
    fields?: readonly string[];
    nextPageToken?: string;
    maxResults?: number;
  }): Promise<JiraSearchPage> {
    return this.#request<JiraSearchPage>('POST', '/rest/api/3/search/jql', {
      body: {
        jql: options.jql,
        fields: [...(options.fields ?? JIRA_ISSUE_FIELDS)],
        maxResults: options.maxResults ?? JIRA_ISSUES_PAGE_SIZE,
        ...(options.nextPageToken ? { nextPageToken: options.nextPageToken } : {}),
      },
    });
  }

  async getIssue(keyOrId: string): Promise<JiraIssue> {
    return this.#request<JiraIssue>('GET', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}`, {
      query: { fields: JIRA_ISSUE_FIELDS.join(',') },
    });
  }

  async listComments(keyOrId: string, options: { startAt?: number } = {}): Promise<JiraCommentPage> {
    return this.#request<JiraCommentPage>('GET', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/comment`, {
      query: { startAt: options.startAt ?? 0, maxResults: JIRA_COMMENTS_PAGE_SIZE },
    });
  }

  async createComment(keyOrId: string, body: string): Promise<JiraComment> {
    return this.#request<JiraComment>('POST', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/comment`, {
      body: { body: textToAdf(body) },
    });
  }

  async listTransitions(keyOrId: string): Promise<JiraTransition[]> {
    const data = await this.#request<{ transitions?: JiraTransition[] }>(
      'GET',
      `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/transitions`,
    );
    return data.transitions ?? [];
  }

  async applyTransition(keyOrId: string, transitionId: string): Promise<void> {
    await this.#request<void>('POST', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/transitions`, {
      body: { transition: { id: transitionId } },
    });
  }
}
