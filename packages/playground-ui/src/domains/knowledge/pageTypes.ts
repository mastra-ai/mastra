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
  /** Declaration key the scope page was materialized from; scope pages only. */
  declaration?: string;
  /** Its declaration's `displayLabel` (e.g. "Team"), added by the host; scope pages only. Falls back to "Scope". */
  displayLabel?: string;
  /** Stable key among its siblings; ordinary pages only. Forms the page's path: `org:acme#policies/refund`. */
  key?: string;
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

export type KnowledgeActivityAction =
  | 'scope-created'
  | 'page-created'
  | 'page-updated'
  | 'page-moved'
  | 'page-merged'
  | 'page-deleted'
  | 'note-added'
  | 'note-restamped'
  | 'note-removed'
  | 'note-restored'
  | 'pin-added'
  | 'pin-removed';

export interface KnowledgePageActivityPayload {
  id: string;
  action: KnowledgeActivityAction;
  scopeId: string;
  pageId: string;
  noteId?: string;
  provenance: KnowledgeProvenancePayload;
  createdAt: string;
}

/**
 * A graph edge between two pages. `parent`: tree containment (parent → child).
 * `mention`: notes on `source` mention `target`; `count` is how many.
 * `grant`: the `source` scope's holders get `role` on the `target` scope.
 */
export interface KnowledgePageEdge {
  source: string;
  target: string;
  kind: 'parent' | 'mention' | 'grant';
  count?: number;
  role?: KnowledgeRolePayload;
}

/** @experimental */
export type KnowledgeRolePayload = 'viewer' | 'contributor' | 'editor' | 'owner';

/**
 * A scope declaration's access rule bound to a scope in the graph: holders of `principal` get `role` on
 * `target`. `principalId` is the principal's scope page when it exists; a declared principal nothing has
 * been written to yet has none, and the graph draws it as a placeholder circle.
 */
export interface KnowledgeScopeGrantPayload {
  principal: string;
  principalId?: string;
  /** The principal's declaration `displayLabel`, e.g. "acme admin". */
  principalLabel?: string;
  target: string;
  role: KnowledgeRolePayload;
}
