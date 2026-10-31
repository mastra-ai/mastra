/**
 * Payload types for the Knowledge explorer (graph, nodes, records, pins, scope view).
 * Hosts (Factory UI, Mastra Studio) fetch these shapes; the components only render them.
 */

export type KnowledgeRung = 'org' | 'resource' | 'thread';

/** A reconciled structural scope node from the server's scope tree. */
export interface KnowledgeScopeNode {
  id: string;
  /** Canonical address the scope node was reconciled from (e.g. `org:acme`). */
  address: string;
  name: string;
  kind?: string;
  description?: string;
  parentIds: string[];
  /** Viewer-visible direct members, capped by the server's node window. */
  memberCount: number;
  /** True when more direct members may exist beyond `memberCount`. */
  memberCountTruncated: boolean;
  /** Viewer-visible content nodes directly assigned to this scope. */
  contentNodeCount: number;
  /** Direct child scopes available for lazy expansion. */
  childScopeCount: number;
}

export interface KnowledgeSearchResult {
  id: string;
  name: string;
  kind: string;
  type: 'scope' | 'node';
  rung: KnowledgeRung | null;
  threadId?: string;
  address?: string;
  description?: string;
}

export interface KnowledgeSearchPayload {
  results: KnowledgeSearchResult[];
  truncated: boolean;
}

export interface KnowledgeScopeTreePayload {
  roots: Array<{
    level: KnowledgeRung;
    id: string;
    available: boolean;
    /**
     * Set when a reconciled scope node owns this rung's address — the client
     * renders ONE entry (structural name, identity kind) that opens the
     * structural lens, instead of duplicating the scope under two labels.
     */
    scopeNodeId?: string;
    /** Structural name of the matched scope node (present iff scopeNodeId). */
    name?: string;
  }>;
  defaultLevel: 'resource';
  /** Reconciled structural scope tree (omitted when the adapter lacks it). */
  scopeNodes?: KnowledgeScopeNode[];
  /** Cursor for the next sibling page (roots when parentId is omitted). */
  nextCursor?: string;
  /** Initial child-page cursors keyed by parent scope id. */
  childCursors?: Record<string, string>;
  /** True when the org has more scopes than the server reads, so some are missing from the tree. */
  truncated?: boolean;
}

/**
 * What the explore view reads: an identity rung (org/resource/thread), one
 * reconciled structural scope node by id, or a merged entry carrying both
 * (a scope node that owns a rung's address — structural lens plus the rung
 * for activity/flyout context).
 */
export type KnowledgeSelection =
  | { scopeLevel: KnowledgeRung; scopeNodeId?: never }
  | { scopeNodeId: string; scopeLevel?: KnowledgeRung };

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  /** Null for structural scope-node members (global, not identity-scoped). */
  scope: string[] | null;
  rung: KnowledgeRung | null;
  /** True for structural scope nodes (member-lens drill targets); absent for content nodes. */
  isScope?: boolean;
  /** Client-rendered authorized target beyond the bounded node window. */
  isBoundary?: boolean;
  /** A pinned record's wikilinks reference this node (the pin accent). */
  pinned: boolean;
  /** Knowledge records owned by this node inside the snapshot window (not a total). */
  recordCount: number;
  /** Viewer-visible direct members. Present only for structural scope nodes. */
  memberCount?: number;
  memberCountTruncated?: boolean;
  contentNodeCount?: number;
  childScopeCount?: number;
  /** Omitted for a structural lens root the adapter cannot read back as a node. */
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  /**
   * 'wikilink': derived from a record's wikilinks (the record's owner node is
   * the edge source). 'contains': structural lens only — the selected scope
   * node contains the target member, so the clicked scope renders as its own
   * graph root.
   */
  type: 'wikilink' | 'contains';
  /** The record whose text produced the edge; absent on containment edges. */
  recordId?: string;
  /** Derived from a PINNED record — the pin marks the relationship (A9). */
  pinned?: boolean;
}

/**
 * A knowledge record as a first-class graph element (A11): a windowed record with the
 * in-window nodes it touches, owner first (pins omit the hidden reserved
 * owner). Rendered by arity — 1: dot, 2: line, 3+: junction.
 */
export interface KnowledgeGraphRecord {
  id: string;
  nodeIds: string[];
  pinned: boolean;
  /** Knowledge record text, truncated server-side for hover cards. */
  text: string;
}

export interface KnowledgeBoundaryNode {
  id: string;
  name: string;
  scope: string[];
  rung: KnowledgeRung;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  truncated: boolean;
  outOfWindow: KnowledgeBoundaryNode[];
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeNodeRecord {
  id: string;
  node: string;
  relation: 'owned' | 'mentions';
  text: string;
  scope: string[];
  rung: KnowledgeRung;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
  /** This record IS a pin (authored under the reserved pinned node). */
  pinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeActivityEvent {
  id: string;
  action: string;
  recordType: string;
  recordId?: string;
  scope: string[];
  node: {
    id: string;
    name: string;
    rung: KnowledgeRung;
    threadId?: string;
  };
  createdAt: string;
}

export interface KnowledgeActivityPayload {
  events: KnowledgeActivityEvent[];
  nextCursor?: string;
  /** The scope has more members than activity covers; events for the rest are omitted. */
  truncated?: boolean;
}

export interface KnowledgeNodePayload {
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
  records: KnowledgeNodeRecord[];
}
