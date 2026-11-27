import { MastraClientError } from '@mastra/client-js';
import type { MastraClient } from '@mastra/client-js';
import { MastraError } from '@mastra/core/error';
import type { PaginationInfo } from '@mastra/core/storage';

type QueryValue = string | number | string[] | { field?: string; direction?: string } | undefined;

/**
 * The Platform's dataset routes, which run core's own dataset handlers. Calls go through
 * `MastraClient.request` with core's argument shapes, which the generated client-js methods type
 * more narrowly; the server validates every body and query.
 */
export class DatasetsHttp {
  readonly #client: MastraClient;

  constructor(client: MastraClient) {
    this.#client = client;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.#client.request<T>(`${path}${toQueryString(query)}`);
  }

  send<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: object): Promise<T> {
    return this.#client.request<T>(path, { method, ...(body ? { body } : {}) });
  }
}

function toQueryString(query: Record<string, QueryValue> | undefined): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    } else if (typeof value === 'object') {
      if (value.field) params.set(`${key}[field]`, value.field);
      if (value.direction) params.set(`${key}[direction]`, value.direction);
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const datasetPath = (datasetId: string, ...rest: (string | number)[]) =>
  `/datasets/${[datasetId, ...rest].map(part => encodeURIComponent(part)).join('/')}`;

// Response fields the server sends as ISO strings and core's types declare as `Date`.
export const DATASET_DATES = ['createdAt', 'updatedAt'] as const;
export const VERSION_DATES = ['createdAt'] as const;
export const EXPERIMENT_DATES = ['startedAt', 'completedAt', 'createdAt', 'updatedAt'] as const;
export const RESULT_DATES = ['startedAt', 'completedAt', 'createdAt'] as const;

/**
 * Turn a JSON response into core's type by parsing the named date fields. Only those top-level
 * fields are touched, so dates inside item `input`/`metadata` stay as the caller stored them. The
 * Platform serves core's own handlers, so their response schemas are the shapes being converted.
 */
export function revive<T>(value: object, dateKeys: readonly string[]): T {
  const out: Record<string, unknown> = { ...value };
  for (const key of dateKeys) {
    const raw = out[key];
    if (typeof raw === 'string') out[key] = new Date(raw);
  }
  return out as T;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof MastraClientError && error.status === 404;
}

export function notFound(id: 'DATASET_NOT_FOUND' | 'EXPERIMENT_NOT_FOUND', text: string, cause: unknown): MastraError {
  return new MastraError({ id, text, domain: 'STORAGE', category: 'USER' }, cause);
}

/** Throws for core options the Platform's HTTP API can't honor, instead of silently dropping them. */
export function rejectUnsupported(method: string, args: object | undefined, keys: readonly string[]): void {
  if (!args) return;
  const given = keys.filter(key => (args as Record<string, unknown>)[key] !== undefined);
  if (given.length === 0) return;
  throw new MastraError({
    id: 'PLATFORM_DATASETS_UNSUPPORTED_OPTION',
    text: `${method}: ${given.join(', ')} ${given.length === 1 ? 'is' : 'are'} not supported by Mastra Platform datasets`,
    domain: 'STORAGE',
    category: 'USER',
  });
}

export function unsupportedMethod(method: string, hint: string): MastraError {
  return new MastraError({
    id: 'PLATFORM_DATASETS_UNSUPPORTED_METHOD',
    text: `${method} is not supported by Mastra Platform datasets. ${hint}`,
    domain: 'STORAGE',
    category: 'USER',
  });
}

const PAGE_SIZE = 100;

/** Reads every page of a paginated route; HTTP pagination has no `perPage: false`. */
export async function readAllPages<T>(
  fetchPage: (page: number, perPage: number) => Promise<{ rows: T[]; pagination: PaginationInfo }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const result = await fetchPage(page, PAGE_SIZE);
    rows.push(...result.rows);
    if (!result.pagination.hasMore || result.rows.length === 0) return rows;
  }
}

/** Applies core's `page`/`perPage` (including `perPage: false`) to rows filtered on this side. */
export function paginate<T>(
  rows: T[],
  page = 0,
  perPage: number | false = 20,
): { rows: T[]; pagination: PaginationInfo } {
  if (perPage === false) {
    return { rows, pagination: { total: rows.length, page: 0, perPage: false, hasMore: false } };
  }
  const start = page * perPage;
  return {
    rows: rows.slice(start, start + perPage),
    pagination: { total: rows.length, page, perPage, hasMore: start + perPage < rows.length },
  };
}
