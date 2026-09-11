/**
 * Typed Jira Cloud REST client (API v3).
 *
 * Shared by the direct and Platform-managed Jira integrations. Direct Jira
 * uses Basic auth against an Atlassian site; Platform Jira points the same
 * client at a connection proxy with a bearer token. Both modes use the same
 * request shapes, timeout, and error normalization.
 *
 * Endpoint notes (Jira Cloud, 2026):
 * - Issue search is `POST /rest/api/3/search/jql` — the legacy
 *   `GET /rest/api/3/search` endpoint has been removed. The new endpoint
 *   returns only ids unless `fields` is requested explicitly, and pages with
 *   an opaque `nextPageToken` cursor (no `startAt`/`total`).
 * - Project listing is `GET /rest/api/3/project/search` with classic
 *   `startAt`/`isLast` paging.
 * - Descriptions and comment bodies are ADF documents (see `adf.ts`).
 */

import type { AdfNode } from './adf.js';
import { textToAdf } from './adf.js';

const JIRA_TIMEOUT_MS = 15_000;
/** Issue page size — Linear parity (`LINEAR_ISSUES_PAGE_SIZE`). */
export const JIRA_ISSUES_PAGE_SIZE = 30;
/** Comment page size — Linear parity (`LINEAR_COMMENTS_PAGE_SIZE`). */
export const JIRA_COMMENTS_PAGE_SIZE = 50;
export const JIRA_PROJECTS_PAGE_SIZE = 50;

/** Fields requested from issue reads — `search/jql` returns ids only without an explicit list. */
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

interface JiraApiClientBaseConfig {
  /** Jira API base URL, either the Atlassian site or a Platform connection proxy. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export type JiraApiClientConfig = JiraApiClientBaseConfig &
  (
    | {
        /** Atlassian account email the API token belongs to. */
        email: string;
        /** API token from id.atlassian.com → Security → API tokens. */
        apiToken: string;
        accessToken?: never;
      }
    | {
        /** Bearer token used when the base URL is a Mastra Platform connection proxy. */
        accessToken: string;
        email?: never;
        apiToken?: never;
      }
  );

/** Stable error code the routes/tools surface to the SPA and agents. */
export type JiraApiErrorCode = 'jira_auth_failed' | 'jira_request_failed';

/** Normalized Jira API failure carrying the HTTP status and Jira's error detail. */
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
  /** `new` | `indeterminate` | `done` — Jira's fixed status families. */
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
  /** Opaque cursor for the next page; absent on the last page. */
  nextPageToken?: string | null;
}

export interface JiraTransition {
  id: string;
  name: string;
  /** Target status the transition moves the issue to. */
  to?: JiraStatus;
}

export class JiraApiClient {
  readonly #baseUrl: string;
  readonly #authHeader: string;
  readonly #fetch: typeof fetch;

  constructor(config: JiraApiClientConfig) {
    if (!config.baseUrl) {
      throw new Error('JiraApiClient is missing required config: baseUrl.');
    }
    if ('accessToken' in config) {
      if (!config.accessToken) {
        throw new Error('JiraApiClient is missing required config: accessToken.');
      }
      this.#authHeader = `Bearer ${config.accessToken}`;
    } else {
      const missing = (['email', 'apiToken'] as const).filter(key => !config[key]);
      if (missing.length > 0) {
        throw new Error(`JiraApiClient is missing required config: ${missing.join(', ')}.`);
      }
      this.#authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;
    }
    this.#baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.#fetch = config.fetchImpl ?? globalThis.fetch;
  }

  /** Normalized site base URL (no trailing slash) — used for `/browse/<key>` links. */
  get baseUrl(): string {
    return this.#baseUrl;
  }

  async #request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${this.#baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const hasBody = options.body !== undefined;
    const res = await this.#fetch(url, {
      method,
      signal: AbortSignal.timeout(JIRA_TIMEOUT_MS),
      headers: {
        authorization: this.#authHeader,
        accept: 'application/json',
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!res.ok) {
      // Jira reports validation failures as `errorMessages` and `errors`;
      // the Platform proxy reports upstream failures through `detail`/`error`/`title`.
      let detail: string | null = null;
      try {
        const errBody = (await res.json()) as {
          errorMessages?: string[];
          errors?: Record<string, string>;
          detail?: string;
          error?: string;
          title?: string;
        };
        detail =
          errBody.errorMessages?.[0] ??
          Object.values(errBody.errors ?? {})[0] ??
          errBody.detail ??
          errBody.error ??
          errBody.title ??
          null;
      } catch {
        // Non-JSON error body; fall back to the status code alone.
      }
      throw new JiraApiError(`Jira API request failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async getServerInfo(): Promise<JiraServerInfo> {
    return this.#request<JiraServerInfo>('GET', '/rest/api/3/serverInfo');
  }

  /** One page of the site's projects (Settings intake-source picker). */
  async listProjects(options: { startAt?: number } = {}): Promise<JiraProjectSearchPage> {
    return this.#request<JiraProjectSearchPage>('GET', '/rest/api/3/project/search', {
      query: { startAt: options.startAt ?? 0, maxResults: JIRA_PROJECTS_PAGE_SIZE },
    });
  }

  /** One page of a JQL search with explicitly requested fields. */
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

  /** Full issue detail by key (`ENG-42`) or id. */
  async getIssue(keyOrId: string): Promise<JiraIssue> {
    return this.#request<JiraIssue>('GET', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}`, {
      query: { fields: JIRA_ISSUE_FIELDS.join(',') },
    });
  }

  /** One page of an issue's comments (oldest first, Jira default order). */
  async listComments(keyOrId: string, options: { startAt?: number } = {}): Promise<JiraCommentPage> {
    return this.#request<JiraCommentPage>('GET', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/comment`, {
      query: { startAt: options.startAt ?? 0, maxResults: JIRA_COMMENTS_PAGE_SIZE },
    });
  }

  /** Post a plain-text comment (wrapped into a minimal ADF document). */
  async createComment(keyOrId: string, body: string): Promise<JiraComment> {
    return this.#request<JiraComment>('POST', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/comment`, {
      body: { body: textToAdf(body) },
    });
  }

  /** Transitions currently legal for the issue (workflow-dependent). */
  async listTransitions(keyOrId: string): Promise<JiraTransition[]> {
    const data = await this.#request<{ transitions?: JiraTransition[] }>(
      'GET',
      `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/transitions`,
    );
    return data.transitions ?? [];
  }

  /** Apply a transition by id (Jira responds 204 on success). */
  async applyTransition(keyOrId: string, transitionId: string): Promise<void> {
    await this.#request<void>('POST', `/rest/api/3/issue/${encodeURIComponent(keyOrId)}/transitions`, {
      body: { transition: { id: transitionId } },
    });
  }
}
