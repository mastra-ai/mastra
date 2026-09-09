/**
 * Minimal GitLab REST v4 client — only the calls the Intake capability needs.
 *
 * Deliberately hand-rolled over `fetch` rather than pulling in `@gitbeaker/*`:
 * the intake surface touches six endpoints, and a dependency-free client keeps
 * the integration bundleable by the Mastra deployer without extra externals.
 *
 * Pagination uses GitLab's offset pagination (`page` / `per_page`) because the
 * `Intake` contract's cursor is an opaque string and offset pages survive a
 * round-trip through it. Keyset pagination is faster on large projects but its
 * cursor is a full URL; swap it in here if listings get slow.
 */

/** An issue is addressed per-project by `iid`, so a global id needs both parts. */
export interface GitLabIssueRef {
  projectId: string;
  iid: number;
}

const REF_SEPARATOR = '!';

/** `"42!7"` — project 42, issue iid 7. Stored as an `IntakeItem.source.externalId`. */
export function formatIssueRef(ref: GitLabIssueRef): string {
  return `${ref.projectId}${REF_SEPARATOR}${ref.iid}`;
}

export function parseIssueRef(externalId: string): GitLabIssueRef | null {
  const [projectId, rawIid] = externalId.split(REF_SEPARATOR);
  if (!projectId || !rawIid) return null;
  const iid = Number(rawIid);
  return Number.isSafeInteger(iid) && iid > 0 ? { projectId, iid } : null;
}

/**
 * Accept the shapes a human or an agent actually types, not just the stored
 * `externalId`. The canonical `42!7` is tried first; a URL or `group/project#7`
 * yields a URL-encoded path, which GitLab's API accepts wherever it accepts a
 * numeric project id.
 */
export function parseIssueReference(input: string): GitLabIssueRef | null {
  const value = input.trim();
  if (!value) return null;

  const canonical = parseIssueRef(value);
  if (canonical) return canonical;

  const match = /^https?:\/\/[^/]+\/(.+?)\/-\/issues\/(\d+)/.exec(value) ?? /^([^\s#]+\/[^\s#]+)#(\d+)$/.exec(value);
  if (!match) return null;

  const iid = Number(match[2]);
  if (!Number.isSafeInteger(iid) || iid <= 0) return null;
  // GitLab accepts a URL-encoded path anywhere it accepts a numeric project id.
  return { projectId: encodeURIComponent(match[1]!), iid };
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  web_url: string;
}

export interface GitLabUser {
  username: string;
}

export interface GitLabVersion {
  version: string;
  revision: string;
}

export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: 'opened' | 'closed';
  web_url: string;
  references?: { full?: string };
  author: GitLabUser | null;
  assignee: GitLabUser | null;
  assignees?: GitLabUser[];
  labels: string[];
  user_notes_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  system: boolean;
  author: GitLabUser | null;
  created_at: string;
  updated_at?: string;
}

/** A merge request is addressed per-project by `iid`, exactly like an issue. */
export interface GitLabMergeRequestRef {
  projectId: string;
  iid: number;
}

/** `"42!7"` — project 42, merge request iid 7. Shares the issue ref encoding. */
export function formatMergeRequestRef(ref: GitLabMergeRequestRef): string {
  return formatIssueRef(ref);
}

export function parseMergeRequestRef(externalId: string): GitLabMergeRequestRef | null {
  return parseIssueRef(externalId);
}

/**
 * Accept a merge-request URL or `group/project!7` alongside the canonical ref.
 * GitLab's own shorthand for a merge request is `!`, which collides with the
 * ref separator, so `group/project!7` is only read as a path when it holds a
 * slash — `42!7` stays a canonical ref.
 */
export function parseMergeRequestReference(input: string): GitLabMergeRequestRef | null {
  const value = input.trim();
  if (!value) return null;

  const match =
    /^https?:\/\/[^/]+\/(.+?)\/-\/merge_requests\/(\d+)/.exec(value) ?? /^([^\s!]+\/[^\s!]+)!(\d+)$/.exec(value);
  if (match) {
    const iid = Number(match[2]);
    if (!Number.isSafeInteger(iid) || iid <= 0) return null;
    return { projectId: encodeURIComponent(match[1]!), iid };
  }

  return parseMergeRequestRef(value);
}

/** GitLab's own MR lifecycle vocabulary, mapped to the capability's in `version-control.ts`. */
export type GitLabMergeRequestState = 'opened' | 'closed' | 'merged' | 'locked';

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: GitLabMergeRequestState;
  web_url: string;
  references?: { full?: string };
  author: GitLabUser | null;
  assignees?: GitLabUser[];
  reviewers?: GitLabUser[];
  labels: string[];
  draft?: boolean;
  work_in_progress?: boolean;
  /** `can_be_merged` | `cannot_be_merged` | `checking` | `unchecked` — `checking` is undecided, not false. */
  merge_status?: string;
  detailed_merge_status?: string;
  source_branch: string;
  target_branch: string;
  sha: string | null;
  merge_commit_sha: string | null;
  squash_commit_sha?: string | null;
  created_at: string;
  updated_at: string;
}

/** A note's anchor in the diff. Absent on discussion notes that aren't diff-anchored. */
export interface GitLabNotePosition {
  base_sha?: string;
  head_sha?: string;
  start_sha?: string;
  new_path?: string | null;
  old_path?: string | null;
  new_line?: number | null;
  old_line?: number | null;
  position_type?: string;
}

export interface GitLabDiscussionNote extends GitLabNote {
  position?: GitLabNotePosition | null;
  resolvable?: boolean;
  resolved?: boolean;
  type?: string | null;
}

export interface GitLabDiscussion {
  id: string;
  individual_note: boolean;
  notes: GitLabDiscussionNote[];
}

export interface GitLabApprovals {
  approved_by?: { user: GitLabUser }[];
}

export interface GitLabDiffRefs {
  base_sha: string | null;
  head_sha: string | null;
  start_sha: string | null;
}

export interface GitLabPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Thrown for infrastructure failures. Policy misses return `null` instead — see `Intake`. */
export class GitLabApiError extends Error {
  readonly status: number;

  // Plain field assignment rather than a constructor parameter property, so
  // these modules stay loadable by Node's type-stripping (`node file.ts`)
  // without a build step.
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitLabApiError';
    this.status = status;
  }
}

export interface GitLabClientOptions {
  /** Instance origin, no trailing slash: `https://gitlab.com` or a self-hosted host. */
  baseUrl: string;
  /** OAuth access token or personal access token — both ride the same header. */
  accessToken: string;
  requestTimeoutMs?: number;
  pageSize?: number;
}

export class GitLabClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly timeoutMs: number;
  private readonly pageSize: number;

  constructor(options: GitLabClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.accessToken = options.accessToken;
    this.timeoutMs = options.requestTimeoutMs ?? 15_000;
    this.pageSize = options.pageSize ?? 30;
  }

  /** Path is appended to `/api/v4`; `params` skips undefined values. */
  private async request<T>(
    path: string,
    init?: { method?: string; params?: Record<string, string | number | undefined>; body?: unknown },
  ): Promise<{ data: T; headers: Headers }> {
    const url = new URL(`${this.baseUrl}/api/v4${path}`);
    for (const [key, value] of Object.entries(init?.params ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method: init?.method ?? 'GET',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

    if (!response.ok) {
      let detail: string | null = null;
      try {
        const parsed: unknown = await response.json();
        if (parsed && typeof parsed === 'object' && 'message' in parsed) detail = String(parsed.message);
      } catch {
        // Non-JSON error body (HTML from a proxy, empty 502) — the status carries the signal.
      }
      throw new GitLabApiError(
        `GitLab API request failed (${response.status})${detail ? `: ${detail}` : ''}`,
        response.status,
      );
    }

    return { data: (await response.json()) as T, headers: response.headers };
  }

  /** `x-next-page` is empty on the last page; GitLab omits it entirely past the end. */
  private nextCursor(headers: Headers): string | null {
    const next = headers.get('x-next-page');
    return next && next.trim() !== '' ? next.trim() : null;
  }

  private pageParam(cursor?: string): number | undefined {
    if (!cursor) return undefined;
    const page = Number(cursor);
    return Number.isSafeInteger(page) && page > 0 ? page : undefined;
  }

  /** Identity behind the current token — used by the status route to prove the grant works. */
  async getCurrentUser(): Promise<GitLabUser> {
    const { data } = await this.request<GitLabUser>('/user');
    return data;
  }

  /** Instance version, so a self-hosted misconfiguration surfaces as a real answer. */
  async getVersion(): Promise<GitLabVersion> {
    const { data } = await this.request<GitLabVersion>('/version');
    return data;
  }

  /** Projects the token can push to — the intake "sources" a user picks from. */
  async listProjects(): Promise<GitLabProject[]> {
    const { data } = await this.request<GitLabProject[]>('/projects', {
      params: { membership: 'true', min_access_level: 30, per_page: 100, order_by: 'last_activity_at' },
    });
    return data;
  }

  async listProjectIssues(args: {
    projectId: string;
    labels?: string[];
    state?: 'opened' | 'closed' | 'all';
    cursor?: string;
  }): Promise<GitLabPage<GitLabIssue>> {
    const { data, headers } = await this.request<GitLabIssue[]>(
      `/projects/${encodeURIComponent(args.projectId)}/issues`,
      {
        params: {
          state: args.state ?? 'opened',
          labels: args.labels?.length ? args.labels.join(',') : undefined,
          per_page: this.pageSize,
          page: this.pageParam(args.cursor),
          order_by: 'updated_at',
        },
      },
    );
    return { items: data, nextCursor: this.nextCursor(headers) };
  }

  async getIssue(ref: GitLabIssueRef): Promise<GitLabIssue | null> {
    try {
      const { data } = await this.request<GitLabIssue>(
        `/projects/${encodeURIComponent(ref.projectId)}/issues/${ref.iid}`,
      );
      return data;
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) return null;
      throw error;
    }
  }

  /** System notes (label changes, mentions) are filtered out — they aren't discussion. */
  async listIssueNotes(ref: GitLabIssueRef): Promise<GitLabNote[]> {
    const { data } = await this.request<GitLabNote[]>(
      `/projects/${encodeURIComponent(ref.projectId)}/issues/${ref.iid}/notes`,
      { params: { per_page: 100, sort: 'asc', order_by: 'created_at' } },
    );
    return data.filter(note => !note.system);
  }

  async createIssueNote(ref: GitLabIssueRef, body: string): Promise<GitLabNote> {
    const { data } = await this.request<GitLabNote>(
      `/projects/${encodeURIComponent(ref.projectId)}/issues/${ref.iid}/notes`,
      { method: 'POST', body: { body } },
    );
    return data;
  }

  async setIssueState(ref: GitLabIssueRef, event: 'close' | 'reopen'): Promise<GitLabIssue> {
    const { data } = await this.request<GitLabIssue>(
      `/projects/${encodeURIComponent(ref.projectId)}/issues/${ref.iid}`,
      { method: 'PUT', body: { state_event: event } },
    );
    return data;
  }

  private mrPath(ref: GitLabMergeRequestRef, suffix = ''): string {
    return `/projects/${encodeURIComponent(ref.projectId)}/merge_requests/${ref.iid}${suffix}`;
  }

  async listMergeRequests(args: {
    projectId: string;
    state?: GitLabMergeRequestState | 'all';
    cursor?: string;
  }): Promise<GitLabPage<GitLabMergeRequest>> {
    const { data, headers } = await this.request<GitLabMergeRequest[]>(
      `/projects/${encodeURIComponent(args.projectId)}/merge_requests`,
      {
        params: {
          state: args.state ?? 'opened',
          per_page: this.pageSize,
          page: this.pageParam(args.cursor),
          order_by: 'updated_at',
        },
      },
    );
    return { items: data, nextCursor: this.nextCursor(headers) };
  }

  async getMergeRequest(ref: GitLabMergeRequestRef): Promise<GitLabMergeRequest | null> {
    try {
      const { data } = await this.request<GitLabMergeRequest>(this.mrPath(ref));
      return data;
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) return null;
      throw error;
    }
  }

  async createMergeRequest(args: {
    projectId: string;
    title: string;
    description?: string;
    sourceBranch: string;
    targetBranch: string;
    removeSourceBranch?: boolean;
  }): Promise<GitLabMergeRequest> {
    const { data } = await this.request<GitLabMergeRequest>(
      `/projects/${encodeURIComponent(args.projectId)}/merge_requests`,
      {
        method: 'POST',
        body: {
          title: args.title,
          description: args.description,
          source_branch: args.sourceBranch,
          target_branch: args.targetBranch,
          remove_source_branch: args.removeSourceBranch,
        },
      },
    );
    return data;
  }

  async updateMergeRequest(
    ref: GitLabMergeRequestRef,
    patch: {
      title?: string;
      description?: string | null;
      targetBranch?: string;
      stateEvent?: 'close' | 'reopen';
    },
  ): Promise<GitLabMergeRequest> {
    const { data } = await this.request<GitLabMergeRequest>(this.mrPath(ref), {
      method: 'PUT',
      body: {
        title: patch.title,
        // `null` clears the description, so it must survive as an explicit null.
        ...(patch.description === undefined ? {} : { description: patch.description }),
        target_branch: patch.targetBranch,
        state_event: patch.stateEvent,
      },
    });
    return data;
  }

  /**
   * GitLab rejects a merge that isn't ready with 405/406/409 rather than a body
   * flag, so those surface as a refusal the caller can report instead of an
   * infrastructure error.
   */
  async acceptMergeRequest(
    ref: GitLabMergeRequestRef,
    args: { commitMessage?: string; squash?: boolean; squashCommitMessage?: boolean } = {},
  ): Promise<{ mergeRequest: GitLabMergeRequest | null; refusal: string | null }> {
    try {
      const { data } = await this.request<GitLabMergeRequest>(this.mrPath(ref, '/merge'), {
        method: 'PUT',
        body: {
          ...(args.squash ? { squash: true } : {}),
          ...(args.commitMessage === undefined
            ? {}
            : args.squash
              ? { squash_commit_message: args.commitMessage }
              : { merge_commit_message: args.commitMessage }),
        },
      });
      return { mergeRequest: data, refusal: null };
    } catch (error) {
      if (error instanceof GitLabApiError && [405, 406, 409, 422].includes(error.status)) {
        return { mergeRequest: null, refusal: error.message };
      }
      throw error;
    }
  }

  async listMergeRequestNotes(ref: GitLabMergeRequestRef, cursor?: string): Promise<GitLabPage<GitLabNote>> {
    const { data, headers } = await this.request<GitLabNote[]>(this.mrPath(ref, '/notes'), {
      params: { per_page: this.pageSize, page: this.pageParam(cursor), sort: 'asc', order_by: 'created_at' },
    });
    return { items: data.filter(note => !note.system), nextCursor: this.nextCursor(headers) };
  }

  async createMergeRequestNote(ref: GitLabMergeRequestRef, body: string): Promise<GitLabNote> {
    const { data } = await this.request<GitLabNote>(this.mrPath(ref, '/notes'), { method: 'POST', body: { body } });
    return data;
  }

  async updateMergeRequestNote(ref: GitLabMergeRequestRef, noteId: string, body: string): Promise<GitLabNote> {
    const { data } = await this.request<GitLabNote>(this.mrPath(ref, `/notes/${encodeURIComponent(noteId)}`), {
      method: 'PUT',
      body: { body },
    });
    return data;
  }

  async deleteMergeRequestNote(ref: GitLabMergeRequestRef, noteId: string): Promise<void> {
    await this.request<unknown>(this.mrPath(ref, `/notes/${encodeURIComponent(noteId)}`), { method: 'DELETE' });
  }

  async listMergeRequestDiscussions(
    ref: GitLabMergeRequestRef,
    cursor?: string,
  ): Promise<GitLabPage<GitLabDiscussion>> {
    const { data, headers } = await this.request<GitLabDiscussion[]>(this.mrPath(ref, '/discussions'), {
      params: { per_page: this.pageSize, page: this.pageParam(cursor) },
    });
    return { items: data, nextCursor: this.nextCursor(headers) };
  }

  /** A diff-anchored discussion needs the MR's `diff_refs`; the caller supplies them. */
  async createMergeRequestDiscussion(
    ref: GitLabMergeRequestRef,
    args: {
      body: string;
      position?: {
        baseSha: string;
        headSha: string;
        startSha: string;
        newPath: string;
        oldPath?: string;
        newLine?: number;
        oldLine?: number;
      };
    },
  ): Promise<GitLabDiscussion> {
    const { data } = await this.request<GitLabDiscussion>(this.mrPath(ref, '/discussions'), {
      method: 'POST',
      body: {
        body: args.body,
        ...(args.position
          ? {
              position: {
                base_sha: args.position.baseSha,
                head_sha: args.position.headSha,
                start_sha: args.position.startSha,
                position_type: 'text',
                new_path: args.position.newPath,
                old_path: args.position.oldPath ?? args.position.newPath,
                ...(args.position.newLine === undefined ? {} : { new_line: args.position.newLine }),
                ...(args.position.oldLine === undefined ? {} : { old_line: args.position.oldLine }),
              },
            }
          : {}),
      },
    });
    return data;
  }

  async addMergeRequestDiscussionNote(
    ref: GitLabMergeRequestRef,
    discussionId: string,
    body: string,
  ): Promise<GitLabDiscussionNote> {
    const { data } = await this.request<GitLabDiscussionNote>(
      this.mrPath(ref, `/discussions/${encodeURIComponent(discussionId)}/notes`),
      { method: 'POST', body: { body } },
    );
    return data;
  }

  async approveMergeRequest(ref: GitLabMergeRequestRef): Promise<void> {
    await this.request<unknown>(this.mrPath(ref, '/approve'), { method: 'POST' });
  }

  async unapproveMergeRequest(ref: GitLabMergeRequestRef): Promise<void> {
    await this.request<unknown>(this.mrPath(ref, '/unapprove'), { method: 'POST' });
  }

  async listMergeRequestApprovals(ref: GitLabMergeRequestRef): Promise<GitLabApprovals> {
    const { data } = await this.request<GitLabApprovals>(this.mrPath(ref, '/approvals'));
    return data;
  }

  /** Reviewers and assignees are set by user id, so usernames need resolving first. */
  async setMergeRequestReviewers(ref: GitLabMergeRequestRef, reviewerIds: number[]): Promise<GitLabMergeRequest> {
    const { data } = await this.request<GitLabMergeRequest>(this.mrPath(ref), {
      method: 'PUT',
      body: { reviewer_ids: reviewerIds },
    });
    return data;
  }

  async findUserByUsername(username: string): Promise<(GitLabUser & { id: number }) | null> {
    const { data } = await this.request<(GitLabUser & { id: number })[]>('/users', {
      params: { username },
    });
    return data[0] ?? null;
  }
}
