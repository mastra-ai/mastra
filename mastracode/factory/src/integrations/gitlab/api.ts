import { PlatformApiClient, PlatformApiError } from '../platform/api-client.js';

export const GITLAB_PROJECTS_PAGE_SIZE = 100;
export const GITLAB_ISSUES_PAGE_SIZE = 30;
export const GITLAB_NOTES_PAGE_SIZE = 100;

export type GitLabApiErrorCode = 'gitlab_auth_failed' | 'gitlab_request_failed';

export class GitLabApiError extends Error {
  readonly status: number | null;
  readonly code: GitLabApiErrorCode;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'GitLabApiError';
    this.status = status;
    this.code = status === 401 || status === 403 ? 'gitlab_auth_failed' : 'gitlab_request_failed';
  }
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch?: string | null;
}

export interface GitLabUser {
  name?: string | null;
  username: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description?: string | null;
  state: 'opened' | 'closed';
  web_url: string;
  author?: GitLabUser | null;
  assignee?: GitLabUser | null;
  assignees?: GitLabUser[];
  labels?: string[];
  severity?: string | null;
  user_notes_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author?: GitLabUser | null;
  created_at: string;
  system?: boolean;
}

export interface GitLabApiClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export interface PlatformGitLabApiClientConfig {
  client: PlatformApiClient;
  connectionId: string;
}

export class GitLabApiClient {
  readonly #direct: { baseUrl: string; accessToken: string; fetch: typeof fetch } | null;
  readonly #platform: PlatformGitLabApiClientConfig | null;

  constructor(config: GitLabApiClientConfig | PlatformGitLabApiClientConfig) {
    if ('client' in config) {
      if (!config.connectionId.trim()) throw new Error('GitLabApiClient is missing required config: connectionId.');
      this.#direct = null;
      this.#platform = config;
      return;
    }

    const accessToken = config.accessToken.trim();
    if (!accessToken) throw new Error('GitLabApiClient is missing required config: accessToken.');
    let url: URL;
    try {
      url = new URL(config.baseUrl);
    } catch {
      throw new Error('GitLabApiClient baseUrl must be an absolute HTTP(S) URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('GitLabApiClient baseUrl must be an absolute HTTP(S) URL.');
    }
    this.#direct = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      accessToken,
      fetch: config.fetchImpl ?? globalThis.fetch,
    };
    this.#platform = null;
  }

  async listProjects(options: { page?: number } = {}): Promise<GitLabProject[]> {
    return this.#request<GitLabProject[]>('GET', '/api/v4/projects', {
      query: {
        membership: 'true',
        simple: 'true',
        with_issues_enabled: 'true',
        order_by: 'last_activity_at',
        sort: 'desc',
        page: options.page ?? 1,
        per_page: GITLAB_PROJECTS_PAGE_SIZE,
      },
    });
  }

  async listIssues(projectId: string, options: { page?: number; labels?: string[] } = {}): Promise<GitLabIssue[]> {
    return this.#request<GitLabIssue[]>('GET', `/api/v4/projects/${encodeURIComponent(projectId)}/issues`, {
      query: {
        state: 'opened',
        scope: 'all',
        order_by: 'updated_at',
        sort: 'desc',
        page: options.page ?? 1,
        per_page: GITLAB_ISSUES_PAGE_SIZE,
        labels: options.labels?.length ? options.labels.join(',') : undefined,
      },
    });
  }

  async getIssue(projectId: string, issueIid: number): Promise<GitLabIssue> {
    return this.#request<GitLabIssue>('GET', `/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`);
  }

  async listNotes(projectId: string, issueIid: number, options: { page?: number } = {}): Promise<GitLabNote[]> {
    return this.#request<GitLabNote[]>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`,
      {
        query: { order_by: 'created_at', sort: 'asc', page: options.page ?? 1, per_page: GITLAB_NOTES_PAGE_SIZE },
      },
    );
  }

  async createNote(projectId: string, issueIid: number, body: string): Promise<GitLabNote> {
    return this.#request<GitLabNote>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`,
      { body: { body } },
    );
  }

  async updateIssueState(projectId: string, issueIid: number, stateEvent: 'close' | 'reopen'): Promise<GitLabIssue> {
    return this.#request<GitLabIssue>('PUT', `/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
      body: { state_event: stateEvent },
    });
  }

  async #request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';

    if (this.#platform) {
      const proxyPath = `/v2/connections/${encodeURIComponent(this.#platform.connectionId)}/proxy${path}${suffix}`;
      try {
        return await this.#platform.client.request<T>(method, proxyPath, options.body);
      } catch (error) {
        if (error instanceof PlatformApiError) throw new GitLabApiError(error.message, error.status);
        throw new GitLabApiError(error instanceof Error ? error.message : String(error), null);
      }
    }

    const direct = this.#direct!;
    const headers: Record<string, string> = {
      accept: 'application/json',
      'private-token': direct.accessToken,
    };
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(15_000) };
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await direct.fetch(`${direct.baseUrl}${path}${suffix}`, init);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.split(direct.accessToken).join('[REDACTED]') : String(error);
      throw new GitLabApiError(message, null);
    }
    if (!response.ok) {
      throw new GitLabApiError(await extractError(response), response.status);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

async function extractError(response: Response): Promise<string> {
  try {
    const data = (await response.clone().json()) as Record<string, unknown>;
    if (typeof data.message === 'string' && data.message) return data.message;
    if (typeof data.error === 'string' && data.error) return data.error;
  } catch {
    // Fall through to the status-based message.
  }
  return `GitLab API request failed (${response.status})`;
}
