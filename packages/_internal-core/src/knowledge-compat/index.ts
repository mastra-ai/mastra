/**
 * Knowledge values that storage adapters bundle instead of importing from `@mastra/core`, so adapters keep
 * the same `@mastra/core` peer range as releases without Knowledge. Adapter tests assert these copies equal
 * the current core exports. Runtime behavior that must come from the
 * installed core (errors, sanitizers) is loaded lazily through {@link createKnowledgeCoreLoader} once core
 * advertises a matching Knowledge storage contract.
 */
export const KNOWLEDGE_CORE_FEATURE = 'knowledge-v2';

export const KNOWLEDGE_STORAGE_CONTRACT_VERSION = 1 as const;
export const KNOWLEDGE_STORAGE_SCHEMA_VERSION = 1 as const;

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
export const TABLE_KNOWLEDGE_SCHEMA = 'mastra_knowledge_schema';

/** Every table managed by canonical Knowledge storage, in creation order. */
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
  TABLE_KNOWLEDGE_SCHEMA,
] as const;

/** Knowledge v1 tables with no canonical equivalent; an explicit schema reset drops them. */
export const RETIRED_KNOWLEDGE_TABLE_NAMES = ['mastra_knowledge_cursors'] as const;

/** Mirrors `StorageColumn` from `@mastra/core/storage`. */
export interface KnowledgeStorageColumn {
  type: 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'float' | 'bigint' | 'boolean';
  primaryKey?: boolean;
  nullable?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export const KNOWLEDGE_NODE_SCOPES_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  nodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  addedAt: { type: 'timestamp', nullable: false },
};

export const KNOWLEDGE_RECORD_SCOPES_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  recordId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_RECORDS, column: 'id' } },
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  addedAt: { type: 'timestamp', nullable: false },
};

export const KNOWLEDGE_SCOPE_GRANTS_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  scopeRefId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  role: { type: 'text', nullable: false },
  canSuggest: { type: 'boolean', nullable: true },
};

export const KNOWLEDGE_ACCESS_STATE_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  epoch: { type: 'integer', nullable: false },
};

export const KNOWLEDGE_SCHEMA_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  version: { type: 'integer', nullable: false },
};

export const KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  address: { type: 'text', nullable: false, primaryKey: true },
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
};

export const KNOWLEDGE_NODE_ADDRESSES_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  source: { type: 'text', nullable: false },
  address: { type: 'text', nullable: false },
  nodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
};

export const KNOWLEDGE_IMPORT_STATE_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  importerId: { type: 'text', nullable: false },
  binding: { type: 'text', nullable: false },
  key: { type: 'text', nullable: false },
  value: { type: 'text', nullable: false },
};

export const KNOWLEDGE_IMPORT_RUNS_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  importerId: { type: 'text', nullable: false },
  binding: { type: 'text', nullable: false },
  importKind: { type: 'text', nullable: false },
  triggerKind: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  error: { type: 'text', nullable: true },
  transcriptThreadId: { type: 'text', nullable: true },
  traceId: { type: 'text', nullable: true },
  queuedAt: { type: 'timestamp', nullable: false },
  startedAt: { type: 'timestamp', nullable: true },
  completedAt: { type: 'timestamp', nullable: true },
};

export const KNOWLEDGE_PROPOSALS_SCHEMA: Record<string, KnowledgeStorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  targetType: { type: 'text', nullable: false },
  targetId: { type: 'text', nullable: false },
  action: { type: 'text', nullable: false },
  changes: { type: 'jsonb', nullable: false },
  reason: { type: 'text', nullable: true },
  proposerContextScopeId: { type: 'text', nullable: false },
  expectedVersion: { type: 'integer', nullable: false },
  status: { type: 'text', nullable: false },
  reviewerContextScopeId: { type: 'text', nullable: true },
  reviewedAt: { type: 'timestamp', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
};

const KNOWLEDGE_NODE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Canonicalizes a node UUID. */
export function canonicalizeKnowledgeNodeId(id: string): string {
  const normalized = id.trim().toLowerCase();
  if (!KNOWLEDGE_NODE_ID_PATTERN.test(normalized)) throw new Error('Knowledge node IDs must be UUIDs.');
  return normalized;
}

/** Canonicalizes a set of scope-node UUIDs. */
export function canonicalizeKnowledgeScopeIds(scopeIds: string[]): string[] {
  return [...new Set(scopeIds.map(canonicalizeKnowledgeNodeId))].sort();
}

export function knowledgeScopeIdsKey(scopeIds: string[]): string {
  return canonicalizeKnowledgeScopeIds(scopeIds).join('\u001f');
}

/** Scope nodes are visible through their own identity as well as their direct parent memberships. */
export function isKnowledgeNodeVisible(
  node: { id: string; isScope: boolean },
  nodeScopeIds: string[],
  visibleScopeIds: string[],
): boolean {
  if (node.isScope && visibleScopeIds.includes(node.id)) return true;
  const available = new Set(visibleScopeIds);
  return nodeScopeIds.some(id => available.has(id));
}

/** Knowledge runtime values adapters take from the installed `@mastra/core`. */
export interface KnowledgeCore {
  KnowledgeSchemaError: new (message: string) => Error;
  KnowledgeUnsupportedError: new (adapter?: string) => Error;
  sanitizeKnowledgeImportError(error: unknown): string;
}

const KNOWLEDGE_CORE_EXPORTS = [
  'KnowledgeSchemaError',
  'KnowledgeUnsupportedError',
  'sanitizeKnowledgeImportError',
] as const satisfies readonly (keyof KnowledgeCore)[];

export function assertKnowledgeCoreSupport(features: ReadonlySet<string>): void {
  if (!features.has(KNOWLEDGE_CORE_FEATURE)) {
    throw new Error(`Knowledge requires an @mastra/core release with the "${KNOWLEDGE_CORE_FEATURE}" feature`);
  }
}

function resolveKnowledgeCore(storageModule: unknown): KnowledgeCore {
  const exports = (typeof storageModule === 'object' && storageModule !== null ? storageModule : {}) as Record<
    string,
    unknown
  >;
  if (exports.KNOWLEDGE_STORAGE_CONTRACT_VERSION !== KNOWLEDGE_STORAGE_CONTRACT_VERSION) {
    throw new Error(
      `Knowledge storage contract ${String(exports.KNOWLEDGE_STORAGE_CONTRACT_VERSION)} in @mastra/core does not match the adapter's contract ${KNOWLEDGE_STORAGE_CONTRACT_VERSION}`,
    );
  }
  const missing = KNOWLEDGE_CORE_EXPORTS.filter(name => typeof exports[name] !== 'function');
  if (missing.length > 0) {
    throw new Error(`@mastra/core advertises Knowledge without the required storage API: ${missing.join(', ')}`);
  }
  return exports as unknown as KnowledgeCore;
}

/**
 * Returns a coalesced loader for core's Knowledge runtime. It rejects cores without the Knowledge feature
 * before importing anything, and retries after a failed import.
 */
export function createKnowledgeCoreLoader(
  features: ReadonlySet<string>,
  loadStorageModule: () => Promise<unknown>,
): () => Promise<KnowledgeCore> {
  let knowledgeCore: Promise<KnowledgeCore> | undefined;

  return async () => {
    assertKnowledgeCoreSupport(features);
    knowledgeCore ??= loadStorageModule()
      .then(resolveKnowledgeCore)
      .catch(error => {
        knowledgeCore = undefined;
        throw error;
      });
    return knowledgeCore;
  };
}
