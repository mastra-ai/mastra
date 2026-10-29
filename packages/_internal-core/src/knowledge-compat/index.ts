export const KNOWLEDGE_STORAGE_CONTRACT_VERSION = 4 as const;
export const KNOWLEDGE_STORAGE_SCHEMA_VERSION = 4 as const;

const TABLE_KNOWLEDGE_NODES = 'mastra_knowledge_nodes';
const TABLE_KNOWLEDGE_RECORDS = 'mastra_knowledge_records';
const TABLE_KNOWLEDGE_MENTIONS = 'mastra_knowledge_mentions';
const TABLE_KNOWLEDGE_ACTIVITY = 'mastra_knowledge_activity';
const TABLE_KNOWLEDGE_SEMANTIC_OUTBOX = 'mastra_knowledge_semantic_outbox';
export const TABLE_KNOWLEDGE_NODE_SCOPES = 'mastra_knowledge_node_scopes';
export const TABLE_KNOWLEDGE_RECORD_SCOPES = 'mastra_knowledge_record_scopes';
export const TABLE_KNOWLEDGE_SCOPE_GRANTS = 'mastra_knowledge_scope_grants';
export const TABLE_KNOWLEDGE_ACCESS_STATE = 'mastra_knowledge_access_state';
export const TABLE_KNOWLEDGE_SCOPE_ADDRESSES = 'mastra_knowledge_scope_addresses';
export const TABLE_KNOWLEDGE_NODE_ADDRESSES = 'mastra_knowledge_node_addresses';
export const TABLE_KNOWLEDGE_IMPORT_STATE = 'mastra_knowledge_import_state';
export const TABLE_KNOWLEDGE_IMPORT_RUNS = 'mastra_knowledge_import_runs';
export const TABLE_KNOWLEDGE_PROPOSALS = 'mastra_knowledge_proposals';

export const KNOWLEDGE_TABLE_NAMES = [
  TABLE_KNOWLEDGE_NODES,
  TABLE_KNOWLEDGE_RECORDS,
  TABLE_KNOWLEDGE_MENTIONS,
  TABLE_KNOWLEDGE_ACTIVITY,
  TABLE_KNOWLEDGE_SEMANTIC_OUTBOX,
  TABLE_KNOWLEDGE_NODE_SCOPES,
  TABLE_KNOWLEDGE_RECORD_SCOPES,
  TABLE_KNOWLEDGE_SCOPE_GRANTS,
  TABLE_KNOWLEDGE_ACCESS_STATE,
  TABLE_KNOWLEDGE_SCOPE_ADDRESSES,
  TABLE_KNOWLEDGE_NODE_ADDRESSES,
  TABLE_KNOWLEDGE_IMPORT_STATE,
  TABLE_KNOWLEDGE_IMPORT_RUNS,
  TABLE_KNOWLEDGE_PROPOSALS,
] as const;

/** Knowledge v1 tables with no v2 equivalent; an explicit schema reset drops them. */
export const RETIRED_KNOWLEDGE_TABLE_NAMES = ['mastra_knowledge_cursors'] as const;

type KnowledgeStorageColumn = {
  type: 'text' | 'timestamp' | 'integer' | 'bigint' | 'jsonb' | 'boolean';
  nullable: boolean;
  primaryKey?: boolean;
  references?: {
    table: string;
    column: string;
  };
};

type KnowledgeSchema = Record<string, KnowledgeStorageColumn>;

// ---------------------------------------------------------------------------
// Knowledge schema 4: pages, notes, stamps, mentions, pins.
//
// Shared names and logical columns for every adapter. Adapters may add denormalized filter or index
// columns (the storage contract leaves physical layout to them) but must keep these names and
// columns so data reads the same across stores. Schema 4 has no migration from schema 1 or 2: a
// store holding any older Knowledge table reports `incompatible-reset-required`, and
// `dangerouslyReset()` drops every name in `KNOWLEDGE_RESETTABLE_TABLE_NAMES` (Knowledge tables only,
// never Memory). Cursors in every list output are adapter-opaque strings.
// ---------------------------------------------------------------------------

export const KNOWLEDGE_PAGES_CORE_FEATURE = 'knowledge-pages';
export const KNOWLEDGE_PAGES_SCHEMA_VERSION = 4 as const;

export const TABLE_KNOWLEDGE_PAGES = 'mastra_knowledge_pages';
export const TABLE_KNOWLEDGE_NOTES = 'mastra_knowledge_notes';
export const TABLE_KNOWLEDGE_NOTE_STAMPS = 'mastra_knowledge_note_stamps';
/** Same name as the schema-2 table; schema 4 re-keys it to note → page. */
export const TABLE_KNOWLEDGE_PAGE_MENTIONS = 'mastra_knowledge_mentions';
export const TABLE_KNOWLEDGE_PINS = 'mastra_knowledge_pins';
/** Same name as schema 2; schema 4 re-keys it to scope/page/note. */
export const TABLE_KNOWLEDGE_PAGE_ACTIVITY = 'mastra_knowledge_activity';
/** Holds `{ id: 'knowledge', schemaVersion: 4 }`, written when the schema-4 tables are created. */
export const TABLE_KNOWLEDGE_PAGES_STATE = 'mastra_knowledge_access_state';

export const KNOWLEDGE_PAGES_TABLE_NAMES = [
  TABLE_KNOWLEDGE_PAGES,
  TABLE_KNOWLEDGE_NOTES,
  TABLE_KNOWLEDGE_NOTE_STAMPS,
  TABLE_KNOWLEDGE_PAGE_MENTIONS,
  TABLE_KNOWLEDGE_PINS,
  TABLE_KNOWLEDGE_PAGE_ACTIVITY,
  TABLE_KNOWLEDGE_PAGES_STATE,
] as const;

/** Every Knowledge table any schema version created. Reset drops these and nothing else. */
export const KNOWLEDGE_RESETTABLE_TABLE_NAMES: readonly string[] = [
  ...new Set<string>([...KNOWLEDGE_PAGES_TABLE_NAMES, ...KNOWLEDGE_TABLE_NAMES, ...RETIRED_KNOWLEDGE_TABLE_NAMES]),
];

/** Schema-1/2 tables whose presence means the store needs a reset before schema 4 can run. */
export const LEGACY_KNOWLEDGE_TABLE_NAMES: ReadonlySet<string> = new Set(
  [...KNOWLEDGE_TABLE_NAMES, ...RETIRED_KNOWLEDGE_TABLE_NAMES].filter(
    name => !(KNOWLEDGE_PAGES_TABLE_NAMES as readonly string[]).includes(name),
  ),
);

/** Pages and scope pages. `scopeId` equals `id` on scope pages; `address`/`declaration` only on scope pages. */
export const KNOWLEDGE_PAGES_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  scopeId: { type: 'text', nullable: false },
  parentId: { type: 'text', nullable: true },
  isScope: { type: 'boolean', nullable: false },
  address: { type: 'text', nullable: true },
  declaration: { type: 'text', nullable: true },
  key: { type: 'text', nullable: true },
  position: { type: 'text', nullable: false },
  name: { type: 'text', nullable: false },
  canonicalName: { type: 'text', nullable: false },
  description: { type: 'text', nullable: true },
  body: { type: 'text', nullable: true },
  version: { type: 'integer', nullable: false },
  mergedInto: { type: 'text', nullable: true },
  createdBy: { type: 'jsonb', nullable: false },
  updatedBy: { type: 'jsonb', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
  deletedAt: { type: 'timestamp', nullable: true },
  deletedBy: { type: 'text', nullable: true },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_NOTES_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  pageId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_PAGES, column: 'id' } },
  text: { type: 'text', nullable: false },
  when: { type: 'timestamp', nullable: true },
  provenance: { type: 'jsonb', nullable: false },
  version: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
  deletedAt: { type: 'timestamp', nullable: true },
  deletedBy: { type: 'text', nullable: true },
} as const satisfies KnowledgeSchema;

/** One row per (note, stamp scope). Primary key is the pair. */
export const KNOWLEDGE_NOTE_STAMPS_SCHEMA = {
  noteId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NOTES, column: 'id' } },
  scopeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_PAGES, column: 'id' } },
} as const satisfies KnowledgeSchema;

/** One row per (note, mentioned page). Primary key is the pair. */
export const KNOWLEDGE_PAGE_MENTIONS_SCHEMA = {
  noteId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NOTES, column: 'id' } },
  pageId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_PAGES, column: 'id' } },
} as const satisfies KnowledgeSchema;

/** `audience` is a JSON array of scope addresses (PG may store it as `text[]`, Mongo as an array). */
export const KNOWLEDGE_PINS_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  pageId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_PAGES, column: 'id' } },
  audience: { type: 'jsonb', nullable: false },
  createdBy: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_PAGE_ACTIVITY_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  action: { type: 'text', nullable: false },
  scopeId: { type: 'text', nullable: false },
  pageId: { type: 'text', nullable: false },
  noteId: { type: 'text', nullable: true },
  provenance: { type: 'jsonb', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_PAGES_STATE_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  schemaVersion: { type: 'integer', nullable: false },
} as const satisfies KnowledgeSchema;

export type KnowledgePagesSchemaInspection =
  | { status: 'compatible'; schemaVersion: typeof KNOWLEDGE_PAGES_SCHEMA_VERSION }
  | { status: 'uninitialized'; schemaVersion: null }
  | { status: 'incompatible-reset-required'; schemaVersion: number | null; reason: string };

/**
 * Classifies what an adapter found before creating schema-4 tables. `tableNames` is every
 * `mastra_knowledge_*` table present; `schemaVersion` is the state row's version, if any.
 */
export function inspectKnowledgePagesSchema(snapshot: {
  tableNames: readonly string[];
  schemaVersion?: number;
}): KnowledgePagesSchemaInspection {
  const legacy = snapshot.tableNames.filter(name => LEGACY_KNOWLEDGE_TABLE_NAMES.has(name));
  if (legacy.length > 0) {
    return {
      status: 'incompatible-reset-required',
      schemaVersion: snapshot.schemaVersion ?? null,
      reason: `found Knowledge tables from an earlier schema (${legacy.join(', ')})`,
    };
  }
  if (snapshot.schemaVersion === KNOWLEDGE_PAGES_SCHEMA_VERSION) {
    return { status: 'compatible', schemaVersion: KNOWLEDGE_PAGES_SCHEMA_VERSION };
  }
  if (snapshot.schemaVersion === undefined) {
    const present = snapshot.tableNames.filter(name =>
      (KNOWLEDGE_PAGES_TABLE_NAMES as readonly string[]).includes(name),
    );
    if (present.length === 0) return { status: 'uninitialized', schemaVersion: null };
    return {
      status: 'incompatible-reset-required',
      schemaVersion: null,
      reason: `found Knowledge tables (${present.join(', ')}) without a schema version`,
    };
  }
  return {
    status: 'incompatible-reset-required',
    schemaVersion: snapshot.schemaVersion,
    reason: `Knowledge schema version ${snapshot.schemaVersion} is not ${KNOWLEDGE_PAGES_SCHEMA_VERSION}`,
  };
}

/** Message for the error an adapter throws on `incompatible-reset-required`. */
export function knowledgePagesResetMessage(reason: string): string {
  return `Knowledge storage needs a reset before this version can use it: ${reason}. Knowledge data has no migration; run \`await storage.stores?.knowledge?.dangerouslyReset()\` to drop the Knowledge tables (Memory tables are untouched).`;
}

/**
 * The page-store runtime pieces adapters take from `@mastra/core/storage`. They are loaded through
 * `createKnowledgePagesCoreLoader` instead of static imports so adapters keep loading on cores
 * older than the `knowledge-pages` feature without raising their `@mastra/core` peer floor.
 */
export interface KnowledgePagesCore {
  assertKnowledgePageDescriptionWithinBound(description: string | undefined): void;
  assertKnowledgeNoteTextWithinBound(text: string): void;
  canonicalKnowledgeName(name: string): string;
  knowledgePositionBetween(before?: string, after?: string): string;
  MAX_KNOWLEDGE_MOVE_PAGES: number;
  MAX_KNOWLEDGE_PAGE_DEPTH: number;
  MAX_KNOWLEDGE_PAGE_LIST_LIMIT: number;
  KnowledgeMoveTooLargeError: new (pageId: string, pages: number) => Error;
  KnowledgePageDepthError: new (pageId: string) => Error;
  KnowledgePageHasChildrenError: new (pageId: string) => Error;
  KnowledgePageKeyConflictError: new (key: string, scopeId: string) => Error;
}

const KNOWLEDGE_PAGES_CORE_FUNCTIONS = [
  'assertKnowledgePageDescriptionWithinBound',
  'assertKnowledgeNoteTextWithinBound',
  'canonicalKnowledgeName',
  'knowledgePositionBetween',
  'KnowledgeMoveTooLargeError',
  'KnowledgePageDepthError',
  'KnowledgePageHasChildrenError',
  'KnowledgePageKeyConflictError',
] as const;
const KNOWLEDGE_PAGES_CORE_NUMBERS = [
  'MAX_KNOWLEDGE_MOVE_PAGES',
  'MAX_KNOWLEDGE_PAGE_DEPTH',
  'MAX_KNOWLEDGE_PAGE_LIST_LIMIT',
] as const;

function resolveKnowledgePagesCore(storageModule: unknown): KnowledgePagesCore {
  const module = (typeof storageModule === 'object' && storageModule !== null ? storageModule : {}) as Record<
    string,
    unknown
  >;
  const missing = [
    ...KNOWLEDGE_PAGES_CORE_FUNCTIONS.filter(name => typeof module[name] !== 'function'),
    ...KNOWLEDGE_PAGES_CORE_NUMBERS.filter(name => typeof module[name] !== 'number'),
  ];
  if (missing.length > 0) {
    throw new Error(
      `@mastra/core advertises Knowledge pages without the required storage API (missing ${missing.join(', ')})`,
    );
  }
  return module as unknown as KnowledgePagesCore;
}

/** Loads core's page-store runtime once, after checking core advertises `knowledge-pages`. */
export function createKnowledgePagesCoreLoader(
  features: ReadonlySet<string>,
  loadStorageModule: () => Promise<unknown>,
): () => Promise<KnowledgePagesCore> {
  let core: Promise<KnowledgePagesCore> | undefined;
  return async () => {
    if (!features.has(KNOWLEDGE_PAGES_CORE_FEATURE)) {
      throw new Error(
        `Knowledge requires a @mastra/core release with the "${KNOWLEDGE_PAGES_CORE_FEATURE}" feature. Upgrade @mastra/core to use Knowledge; other storage domains keep working on this version.`,
      );
    }
    core ??= loadStorageModule()
      .then(resolveKnowledgePagesCore)
      .catch(error => {
        core = undefined;
        throw error;
      });
    return core;
  };
}

/**
 * Keyword-search words: the query split on whitespace, lowercased, deduplicated. Every word must
 * appear (as a case-insensitive substring) in a hit; an empty list means the search returns nothing.
 */
export function knowledgeSearchWords(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
}
