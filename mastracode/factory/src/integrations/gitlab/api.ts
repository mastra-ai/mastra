import { PlatformApiClient, PlatformApiError } from '../platform/api-client.js';

export const GITLAB_PROJECTS_PAGE_SIZE = 100;
export const GITLAB_ISSUES_PAGE_SIZE = 30;
export const GITLAB_NOTES_PAGE_SIZE = 100;
export const GITLAB_MIN_ACCESS_LEVEL = 20;
export const GITLAB_MERGE_REQUESTS_PAGE_SIZE = 30;
export const GITLAB_DISCUSSIONS_PAGE_SIZE = 100;

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
  id?: number;
  name?: string | null;
  username: string;
}

export interface GitLabLabelDetail {
  name: string;
  color: string;
  text_color?: string;
}

type GitLabIssueResponse = Omit<GitLabIssue, 'labels' | 'labelDetails'> & {
  labels?: Array<string | GitLabLabelDetail>;
};

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
  labelDetails?: GitLabLabelDetail[];
  weight?: number | null;
  user_notes_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  type?: string | null;
  author?: GitLabUser | null;
  created_at: string;
  updated_at?: string;
  system?: boolean;
}

export interface GitLabDiffRefs {
  base_sha: string;
  start_sha: string;
  head_sha: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description?: string | null;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  web_url: string;
  author?: GitLabUser | null;
  assignees?: GitLabUser[];
  reviewers?: GitLabUser[];
  labels?: string[];
  source_branch: string;
  target_branch: string;
  sha: string;
  merge_commit_sha?: string | null;
  squash_commit_sha?: string | null;
  diff_refs?: GitLabDiffRefs | null;
  merge_status?: string;
  detailed_merge_status?: string;
  draft?: boolean;
  work_in_progress?: boolean;
  merged_at?: string | null;
  user_notes_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GitLabMergeResult extends GitLabMergeRequest {
  message?: string;
}

export interface GitLabDiscussionPosition {
  position_type: 'text';
  base_sha: string;
  start_sha: string;
  head_sha: string;
  old_path: string;
  new_path: string;
  old_line?: number | null;
  new_line?: number | null;
  line_range?: {
    start: GitLabDiscussionLine;
    end: GitLabDiscussionLine;
  };
}

export interface GitLabDiscussionLine {
  line_code: string;
  type: 'old' | 'new';
  old_line?: number | null;
  new_line?: number | null;
}

export interface GitLabDiscussionNote extends GitLabNote {
  position?: GitLabDiscussionPosition | null;
  resolvable?: boolean;
  resolved?: boolean;
}

export interface GitLabDiscussion {
  id: string;
  individual_note?: boolean;
  notes: GitLabDiscussionNote[];
}

export interface GitLabMergeRequestApprovals {
  approved: boolean;
  approvals_required?: number;
  approvals_left?: number;
  approved_by?: Array<{ user: GitLabUser }>;
}

export interface GitLabMember {
  id: number;
  username: string;
  name?: string | null;
  state?: string;
  access_level?: number;
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
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const isLoopback = hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (url.protocol === 'http:' && !isLoopback) {
      throw new Error('GitLabApiClient baseUrl must use HTTPS unless it targets a loopback host.');
    }
    this.#direct = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      accessToken,
      fetch: config.fetchImpl ?? globalThis.fetch,
    };
    this.#platform = null;
  }

  async getCurrentUser(): Promise<GitLabUser> {
    return this.#request<GitLabUser>('GET', '/api/v4/user');
  }

  async getProject(projectId: string): Promise<GitLabProject> {
    return this.#request<GitLabProject>('GET', `/api/v4/projects/${encodeURIComponent(projectId)}`);
  }

  async listProjects(options: { page?: number } = {}): Promise<GitLabProject[]> {
    return this.#request<GitLabProject[]>('GET', '/api/v4/projects', {
      query: {
        membership: 'true',
        simple: 'true',
        with_issues_enabled: 'true',
        min_access_level: GITLAB_MIN_ACCESS_LEVEL,
        order_by: 'last_activity_at',
        sort: 'desc',
        page: options.page ?? 1,
        per_page: GITLAB_PROJECTS_PAGE_SIZE,
      },
    });
  }

  async listIssues(projectId: string, options: { page?: number; labels?: string[] } = {}): Promise<GitLabIssue[]> {
    const issues = await this.#request<GitLabIssueResponse[]>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/issues`,
      {
        query: {
          state: 'opened',
          scope: 'all',
          order_by: 'updated_at',
          sort: 'desc',
          page: options.page ?? 1,
          per_page: GITLAB_ISSUES_PAGE_SIZE,
          labels: options.labels?.length ? options.labels.join(',') : undefined,
          with_labels_details: 'true',
        },
      },
    );
    return issues.map(normalizeIssue);
  }

  async getIssue(projectId: string, issueIid: number): Promise<GitLabIssue> {
    const issue = await this.#request<GitLabIssueResponse>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`,
      { query: { with_labels_details: 'true' } },
    );
    return normalizeIssue(issue);
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

  async listMergeRequests(
    projectId: string,
    options: { page?: number; state?: 'opened' | 'closed' | 'merged' | 'all' } = {},
  ): Promise<GitLabMergeRequest[]> {
    return this.#request<GitLabMergeRequest[]>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`,
      {
        query: {
          state: options.state ?? 'opened',
          order_by: 'updated_at',
          sort: 'desc',
          page: options.page ?? 1,
          per_page: GITLAB_MERGE_REQUESTS_PAGE_SIZE,
        },
      },
    );
  }

  async getMergeRequest(projectId: string, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    return this.#request<GitLabMergeRequest>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`,
    );
  }

  async createMergeRequest(
    projectId: string,
    input: {
      sourceBranch: string;
      targetBranch: string;
      title: string;
      description?: string;
      removeSourceBranch?: boolean;
      squash?: boolean;
    },
  ): Promise<GitLabMergeRequest> {
    return this.#request<GitLabMergeRequest>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`,
      {
        body: {
          source_branch: input.sourceBranch,
          target_branch: input.targetBranch,
          title: input.title,
          description: input.description,
          remove_source_branch: input.removeSourceBranch,
          squash: input.squash,
        },
      },
    );
  }

  async updateMergeRequest(
    projectId: string,
    mergeRequestIid: number,
    input: {
      title?: string;
      description?: string;
      targetBranch?: string;
      stateEvent?: 'close' | 'reopen';
      removeSourceBranch?: boolean;
      squash?: boolean;
      reviewerIds?: number[];
    },
  ): Promise<GitLabMergeRequest> {
    return this.#request<GitLabMergeRequest>(
      'PUT',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`,
      {
        body: {
          title: input.title,
          description: input.description,
          target_branch: input.targetBranch,
          state_event: input.stateEvent,
          remove_source_branch: input.removeSourceBranch,
          squash: input.squash,
          reviewer_ids: input.reviewerIds,
        },
      },
    );
  }

  async mergeMergeRequest(
    projectId: string,
    mergeRequestIid: number,
    options: {
      squash?: boolean;
      mergeCommitMessage?: string;
      squashCommitMessage?: string;
      shouldRemoveSourceBranch?: boolean;
    } = {},
  ): Promise<GitLabMergeResult> {
    return this.#request<GitLabMergeResult>(
      'PUT',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/merge`,
      {
        body: {
          squash: options.squash,
          merge_commit_message: options.mergeCommitMessage,
          squash_commit_message: options.squashCommitMessage,
          should_remove_source_branch: options.shouldRemoveSourceBranch,
        },
      },
    );
  }

  async listMergeRequestNotes(
    projectId: string,
    mergeRequestIid: number,
    options: { page?: number } = {},
  ): Promise<GitLabNote[]> {
    return this.#request<GitLabNote[]>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes`,
      {
        query: {
          order_by: 'created_at',
          sort: 'asc',
          page: options.page ?? 1,
          per_page: GITLAB_NOTES_PAGE_SIZE,
        },
      },
    );
  }

  async createMergeRequestNote(projectId: string, mergeRequestIid: number, body: string): Promise<GitLabNote> {
    return this.#request<GitLabNote>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes`,
      { body: { body } },
    );
  }

  async updateMergeRequestNote(
    projectId: string,
    mergeRequestIid: number,
    noteId: number,
    body: string,
  ): Promise<GitLabNote> {
    return this.#request<GitLabNote>(
      'PUT',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes/${noteId}`,
      { body: { body } },
    );
  }

  async deleteMergeRequestNote(projectId: string, mergeRequestIid: number, noteId: number): Promise<void> {
    await this.#request<void>(
      'DELETE',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes/${noteId}`,
    );
  }

  async listMergeRequestDiscussions(
    projectId: string,
    mergeRequestIid: number,
    options: { page?: number } = {},
  ): Promise<GitLabDiscussion[]> {
    return this.#request<GitLabDiscussion[]>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions`,
      { query: { page: options.page ?? 1, per_page: GITLAB_DISCUSSIONS_PAGE_SIZE } },
    );
  }

  async getMergeRequestDiscussion(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
  ): Promise<GitLabDiscussion> {
    return this.#request<GitLabDiscussion>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions/${encodeURIComponent(discussionId)}`,
    );
  }

  async resolveMergeRequestDiscussion(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
    resolved: boolean,
  ): Promise<GitLabDiscussion> {
    return this.#request<GitLabDiscussion>(
      'PUT',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions/${encodeURIComponent(discussionId)}`,
      { body: { resolved } },
    );
  }

  async createMergeRequestDiscussion(
    projectId: string,
    mergeRequestIid: number,
    input: { body: string; commitId?: string; position?: GitLabDiscussionPosition },
  ): Promise<GitLabDiscussion> {
    return this.#request<GitLabDiscussion>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions`,
      { body: { body: input.body, commit_id: input.commitId, position: input.position } },
    );
  }

  async addMergeRequestDiscussionNote(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
    body: string,
  ): Promise<GitLabDiscussionNote> {
    return this.#request<GitLabDiscussionNote>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions/${encodeURIComponent(discussionId)}/notes`,
      { body: { body } },
    );
  }

  async updateMergeRequestDiscussionNote(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
    noteId: number,
    body: string,
  ): Promise<GitLabDiscussionNote> {
    return this.#request<GitLabDiscussionNote>(
      'PUT',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions/${encodeURIComponent(discussionId)}/notes/${noteId}`,
      { body: { body } },
    );
  }

  async deleteMergeRequestDiscussionNote(
    projectId: string,
    mergeRequestIid: number,
    discussionId: string,
    noteId: number,
  ): Promise<void> {
    await this.#request<void>(
      'DELETE',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/discussions/${encodeURIComponent(discussionId)}/notes/${noteId}`,
    );
  }

  async getMergeRequestApprovals(projectId: string, mergeRequestIid: number): Promise<GitLabMergeRequestApprovals> {
    return this.#request<GitLabMergeRequestApprovals>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/approvals`,
    );
  }

  async approveMergeRequest(projectId: string, mergeRequestIid: number, sha?: string): Promise<GitLabMergeRequest> {
    return this.#request<GitLabMergeRequest>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/approve`,
      sha ? { body: { sha } } : undefined,
    );
  }

  async unapproveMergeRequest(projectId: string, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    return this.#request<GitLabMergeRequest>(
      'POST',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/unapprove`,
    );
  }

  async setMergeRequestReviewers(
    projectId: string,
    mergeRequestIid: number,
    reviewerIds: number[],
  ): Promise<GitLabMergeRequest> {
    return this.#request<GitLabMergeRequest>(
      'PUT',
      `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}`,
      { body: { reviewer_ids: reviewerIds } },
    );
  }

  async listProjectMembers(
    projectId: string,
    options: { query?: string; page?: number } = {},
  ): Promise<GitLabMember[]> {
    return this.#request<GitLabMember[]>(
      'GET',
      `/api/v4/projects/${encodeURIComponent(projectId)}/members/all`,
      {
        query: {
          query: options.query,
          page: options.page ?? 1,
          per_page: GITLAB_DISCUSSIONS_PAGE_SIZE,
        },
      },
    );
  }

  async #request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    // Repository targets carry both the immutable numeric ID for GitLab API
    // requests and the path for browser links. A Platform proxy decodes %2F,
    // so forwarding a path-based project locator would turn into a 404.
    const apiPath = path.replace(/^\/api\/v4\/projects\/([^/]+)/, (full, encoded: string) => {
      const target = decodeURIComponent(encoded);
      const match = /^(\d+):(.+)$/.exec(target);
      return match ? `/api/v4/projects/${encodeURIComponent(match[1]!)}` : full;
    });

    if (this.#platform) {
      const proxyPath = `/v2/connections/${encodeURIComponent(this.#platform.connectionId)}/proxy${apiPath}${suffix}`;
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
      response = await direct.fetch(`${direct.baseUrl}${apiPath}${suffix}`, init);
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

function normalizeIssue(response: GitLabIssueResponse): GitLabIssue {
  const { labels, ...issue } = response;
  const labelDetails = (labels ?? []).filter((label): label is GitLabLabelDetail => typeof label !== 'string');
  return {
    ...issue,
    labels: (labels ?? []).map(label => (typeof label === 'string' ? label : label.name)),
    ...(labelDetails.length > 0 ? { labelDetails } : {}),
  };
}
