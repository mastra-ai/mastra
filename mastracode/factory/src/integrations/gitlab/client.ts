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
}
