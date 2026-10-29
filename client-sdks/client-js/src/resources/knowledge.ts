import type { ClientOptions } from '../types';
import { BaseResource } from './base';

export type KnowledgeRung = 'org' | 'resource' | 'thread';

export interface KnowledgeInstanceSummary {
  key: string;
  id: string;
}

export interface ListKnowledgeResponse {
  instances: KnowledgeInstanceSummary[];
}

export interface KnowledgeScopeSummary {
  id: string;
  address: string;
  name: string;
  kind?: string;
  description?: string;
  parentIds: string[];
  memberCount: number;
  memberCountTruncated: boolean;
  contentNodeCount: number;
  childScopeCount: number;
}

export interface ListKnowledgeScopesResponse {
  scopes: KnowledgeScopeSummary[];
  truncated: boolean;
}

export interface KnowledgeGraphResponse {
  view: 'project' | 'thread';
  nodes: Array<{
    id: string;
    name: string;
    kind: string;
    description?: string;
    scope: string[] | null;
    rung: KnowledgeRung | null;
    isScope?: boolean;
    pinned: boolean;
    recordCount: number;
    memberCount?: number;
    contentNodeCount?: number;
    childScopeCount?: number;
    createdAt?: string;
    updatedAt?: string;
  }>;
  edges: Array<{ id: string; source: string; target: string; type: 'wikilink' | 'contains' }>;
  records: Array<{ id: string; nodeIds: string[]; pinned: boolean; text: string }>;
  truncated: boolean;
  outOfWindow: Array<{ id: string; name: string; scope: string[]; rung: KnowledgeRung }>;
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeNodeResponse {
  node: {
    id: string;
    name: string;
    kind: string;
    content: string;
    description?: string;
    scope: string[];
    rung: KnowledgeRung;
    createdAt: string;
    updatedAt: string;
  };
  records: Array<{
    id: string;
    node: string;
    relation: 'owned' | 'mentions';
    text: string;
    scope: string[];
    rung: KnowledgeRung;
    sourceThreadId: string;
    capturedAt: string;
    when?: string;
    pinned: boolean;
    metadata?: Record<string, unknown>;
  }>;
}

export interface KnowledgeSearchResponse {
  results: Array<{
    id: string;
    name: string;
    kind: string;
    type: 'scope' | 'node';
    rung: KnowledgeRung | null;
    address?: string;
    description?: string;
  }>;
  truncated: boolean;
}

export interface KnowledgeActivityResponse {
  events: Array<{
    id: string;
    action: string;
    recordType: string;
    recordId?: string;
    scope: string[];
    node: { id: string; name: string; rung: KnowledgeRung };
    createdAt: string;
  }>;
  nextCursor?: string;
}

/** Read-only access to one registered Knowledge instance. */
export class Knowledge extends BaseResource {
  constructor(
    options: ClientOptions,
    private knowledgeKey: string,
  ) {
    super(options);
  }

  #path(suffix: string, params: Record<string, string | undefined> = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const query = search.toString();
    return `/knowledge/${encodeURIComponent(this.knowledgeKey)}/${suffix}${query ? `?${query}` : ''}`;
  }

  /** Lists the instance's scope nodes with their direct member counts. */
  scopes(): Promise<ListKnowledgeScopesResponse> {
    return this.request(this.#path('scopes'));
  }

  /** Nodes, records and edges of one scope, or of the whole instance when no scope is given. */
  graph(scopeNodeId?: string): Promise<KnowledgeGraphResponse> {
    return this.request(this.#path('graph', { scopeNodeId }));
  }

  /** One node with the records it owns and the records that mention it. */
  node(nodeId: string): Promise<KnowledgeNodeResponse> {
    return this.request(this.#path(`nodes/${encodeURIComponent(nodeId)}`));
  }

  /** Scopes and nodes whose name contains `query`. */
  search(query: string): Promise<KnowledgeSearchResponse> {
    return this.request(this.#path('search', { q: query }));
  }

  /** A newest-first page of activity in one scope, or in the whole instance. */
  activity(options: { scopeNodeId?: string; cursor?: string } = {}): Promise<KnowledgeActivityResponse> {
    return this.request(this.#path('activity', options));
  }
}
