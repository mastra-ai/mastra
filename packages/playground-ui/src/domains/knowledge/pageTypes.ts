/**
 * Wire payloads for the schema-4 Knowledge explorer: pages, notes and pins as
 * host routes return them (dates as ISO strings). Mirrors the storage
 * contract in `@mastra/core` (`storage/domains/knowledge/pages.ts`) without
 * importing it, so the UI stays independent of server-only types.
 */

export interface KnowledgeProvenancePayload {
  author: string;
  sourceThreadId?: string;
}

export interface KnowledgePagePayload {
  id: string;
  /** Home scope's page id; equals `id` on a scope page. */
  scopeId: string;
  /** Tree parent; `null` only on root scope pages. */
  parentId: string | null;
  isScope: boolean;
  /** Canonical `type:value` address; scope pages only. */
  address?: string;
  /** Fractional sibling ordering key; compare as code-unit strings. */
  position: string;
  name: string;
  description?: string;
  body?: string;
  version: number;
  mergedInto?: string;
  createdBy: KnowledgeProvenancePayload;
  updatedBy: KnowledgeProvenancePayload;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface KnowledgeNotePayload {
  id: string;
  pageId: string;
  text: string;
  when?: string;
  /** Scope page ids that narrow who can see the note (OR). */
  stampScopeIds: string[];
  /** Page ids resolved from `[[mentions]]` in `text`. */
  mentions: string[];
  provenance: KnowledgeProvenancePayload;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePinPayload {
  id: string;
  pageId: string;
  /** Scope addresses the pin is delivered to (OR). */
  audience: string[];
  createdBy: string;
  createdAt: string;
}

/**
 * A graph edge between two pages. `parent`: tree containment (parent → child).
 * `mention`: notes on `source` mention `target`; `count` is how many.
 */
export interface KnowledgePageEdge {
  source: string;
  target: string;
  kind: 'parent' | 'mention';
  count?: number;
}
