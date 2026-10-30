import type { KnowledgePageGraph, KnowledgePageView, KnowledgeTreeChildren } from '@mastra/core/knowledge';
import type { KnowledgePageActivityEvent, KnowledgePageSearchHit } from '@mastra/core/storage';
import type { ClientOptions, Serialized } from '../types';
import { createSseJsonTransform } from '../utils/stream-transforms';

import { BaseResource } from './base';

export type KnowledgeTreeResponse = Serialized<KnowledgeTreeChildren>;
export type KnowledgePageResponse = Serialized<KnowledgePageView>;
export type KnowledgeGraphResponse = Serialized<KnowledgePageGraph>;
export interface KnowledgeSearchResponse {
  results: Serialized<KnowledgePageSearchHit>[];
}
export interface KnowledgeActivityResponse {
  events: Serialized<KnowledgePageActivityEvent>[];
  nextCursor?: string;
}

/** One committed write the caller can read. Ids they can't read are left out; re-read what changed. */
export interface KnowledgeChangeNotice {
  kind: 'scope' | 'page' | 'note' | 'pin';
  op: string;
  pageId?: string;
  scopeId?: string;
  at: string;
}

export interface KnowledgeInstanceSummary {
  key: string;
  id: string;
}

function query(params: Record<string, string | number | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(name, String(item));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/**
 * Read-only access to one Knowledge instance registered on the server. Reads return every page and note,
 * as the instance owner; the server's auth decides who may call them.
 *
 * @experimental Knowledge APIs are experimental and may change without notice.
 */
export class Knowledge extends BaseResource {
  constructor(
    options: ClientOptions,
    private knowledgeKey: string,
  ) {
    super(options);
  }

  private get base() {
    return `/knowledge/${encodeURIComponent(this.knowledgeKey)}`;
  }

  /** One level of the page tree: the root scopes, or `parentId`'s child scopes then its child pages (paged). */
  tree(params: { parentId?: string; cursor?: string; limit?: number } = {}): Promise<KnowledgeTreeResponse> {
    return this.request(`${this.base}/tree${query(params)}`);
  }

  /** One page with its ancestors, notes, pin and references; rejects with 404 when it does not exist. */
  page(pageId: string, params: { noteCursor?: string; noteLimit?: number } = {}): Promise<KnowledgePageResponse> {
    return this.request(`${this.base}/pages/${encodeURIComponent(pageId)}${query(params)}`);
  }

  /** A bounded page graph under `rootId`, or across every root scope. */
  graph(params: { rootId?: string; maxPages?: number } = {}): Promise<KnowledgeGraphResponse> {
    return this.request(`${this.base}/graph${query(params)}`);
  }

  /** Pages and notes matching `searchQuery`, optionally only within the given scope page ids. */
  search(searchQuery: string, params: { scopeIds?: string[]; limit?: number } = {}): Promise<KnowledgeSearchResponse> {
    return this.request(
      `${this.base}/search${query({ q: searchQuery, scopeId: params.scopeIds, limit: params.limit })}`,
    );
  }

  /** A newest-first page of activity, optionally for one scope or one page. */
  activity(
    params: { scopeId?: string; pageId?: string; cursor?: string; limit?: number } = {},
  ): Promise<KnowledgeActivityResponse> {
    return this.request(`${this.base}/activity${query(params)}`);
  }

  /**
   * A live stream of the writes the caller can read, from when it opens until `signal` aborts. Rejects
   * when the server can't stream them (for example 501 on an older @mastra/core).
   */
  async events(params: { signal?: AbortSignal } = {}): Promise<ReadableStream<KnowledgeChangeNotice>> {
    const response: Response = await this.request(`${this.base}/events`, {
      stream: true,
      retries: 0,
      signal: params.signal,
    });
    if (!response.body) throw new Error('Response body is null');
    return response.body.pipeThrough(createSseJsonTransform<KnowledgeChangeNotice>());
  }
}
