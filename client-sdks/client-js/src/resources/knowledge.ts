import type {
  KnowledgeExplorerNode,
  KnowledgeExplorerSearchResult,
  KnowledgeExplorerActivityEvent,
  KnowledgeGraphWindowPayload,
} from '@mastra/core/knowledge';
import type { ClientOptions } from '../types';

import { BaseResource } from './base';

export interface KnowledgeSearchResponse {
  results: Array<KnowledgeExplorerSearchResult & { threadId?: string }>;
  truncated: boolean;
}

export interface KnowledgeActivityResponse {
  events: KnowledgeExplorerActivityEvent[];
  nextCursor?: string;
  truncated?: true;
}

export interface KnowledgeScopeSetSummary {
  scope: string[];
  nodeCount: number;
  recordCount: number;
}

export interface KnowledgeScopesResponse {
  /** Fewest tags first. */
  sets: KnowledgeScopeSetSummary[];
  truncated: boolean;
}

export interface KnowledgeInstanceSummary {
  key: string;
  id: string;
}

function scopeQuery(scope: string[], extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const tag of scope) params.append('scope', tag);
  for (const [name, value] of Object.entries(extra)) {
    if (value !== undefined) params.set(name, String(value));
  }
  return `?${params.toString()}`;
}

/**
 * Read-only access to one Knowledge instance registered on the server. Every read takes the scope tags the
 * viewer holds and returns only what those tags can see.
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

  /** The nodes, records and wikilink edges visible from `scope`, newest first and bounded. */
  graph(scope: string[]): Promise<KnowledgeGraphWindowPayload> {
    return this.request(`${this.base}/graph${scopeQuery(scope)}`);
  }

  /** One node and its records; rejects with 404 when the node is not visible from `scope`. */
  node(nodeId: string, scope: string[]): Promise<KnowledgeExplorerNode> {
    return this.request(`${this.base}/nodes/${encodeURIComponent(nodeId)}${scopeQuery(scope)}`);
  }

  /** Nodes visible from `scope` whose name contains `query`, exact matches first. */
  search(query: string, scope: string[]): Promise<KnowledgeSearchResponse> {
    return this.request(`${this.base}/search${scopeQuery(scope, { q: query })}`);
  }

  /** A newest-first page of activity on nodes visible from `scope`. */
  activity(scope: string[], params: { cursor?: string; limit?: number } = {}): Promise<KnowledgeActivityResponse> {
    return this.request(`${this.base}/activity${scopeQuery(scope, params)}`);
  }

  /** The distinct scope tag sets stored nodes and records carry, with counts; only sets inside a bound caller scope. */
  scopes(): Promise<KnowledgeScopesResponse> {
    return this.request(`${this.base}/scopes`);
  }
}
