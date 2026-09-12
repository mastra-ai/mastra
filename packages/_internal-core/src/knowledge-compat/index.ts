export const KNOWLEDGE_V2_CORE_FEATURE = 'knowledge-v2';
export const KNOWLEDGE_V2_MINIMUM_CORE_VERSION = '1.65.0-0';

export const KNOWLEDGE_STORAGE_CONTRACT_VERSION = 2 as const;
export const KNOWLEDGE_STORAGE_SCHEMA_VERSION = 2 as const;

/** Hard cap on scope nodes returned by one `listScopeNodes` read. */
export const MAX_KNOWLEDGE_SCOPE_NODES = 1000;

/** A reconciled structural scope node with its containing scope nodes. */
export interface KnowledgeScopeNodeSummary {
  /** UUID of the `isScope` node. */
  id: string;
  /** Canonical address the scope node was reconciled from (e.g. `features:memory`). */
  address: string;
  name: string;
  kind?: string;
  description?: string;
  /** UUIDs of the scope nodes that contain this scope (membership edges). */
  parentIds: string[];
}

const TABLE_KNOWLEDGE_NODES = 'mastra_knowledge_nodes';
const TABLE_KNOWLEDGE_RECORDS = 'mastra_knowledge_records';
const TABLE_KNOWLEDGE_MENTIONS = 'mastra_knowledge_mentions';
const TABLE_KNOWLEDGE_CURSORS = 'mastra_knowledge_cursors';
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
  TABLE_KNOWLEDGE_CURSORS,
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

export const KNOWLEDGE_V2_NODES_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  name: { type: 'text', nullable: false },
  kind: { type: 'text', nullable: true },
  isScope: { type: 'boolean', nullable: false },
  metadata: { type: 'jsonb', nullable: true },
  version: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
  deletedAt: { type: 'timestamp', nullable: true },
  deletedBy: { type: 'text', nullable: true },
  type: { type: 'text', nullable: true },
  canonicalName: { type: 'text', nullable: true },
  content: { type: 'text', nullable: true },
  description: { type: 'text', nullable: true },
  scope: { type: 'jsonb', nullable: true },
  scopeKey: { type: 'text', nullable: true },
  mergedInto: { type: 'text', nullable: true },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_V2_RECORDS_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  nodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  text: { type: 'text', nullable: false },
  metadata: { type: 'jsonb', nullable: true },
  source: { type: 'text', nullable: true },
  version: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
  deletedAt: { type: 'timestamp', nullable: true },
  deletedBy: { type: 'text', nullable: true },
  node: { type: 'text', nullable: true },
  scope: { type: 'jsonb', nullable: true },
  scopeKey: { type: 'text', nullable: true },
  sourceThreadId: { type: 'text', nullable: true },
  capturedAt: { type: 'timestamp', nullable: true },
  when: { type: 'timestamp', nullable: true },
  maxScope: { type: 'text', nullable: true },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_V2_MENTIONS_SCHEMA = {
  recordId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_RECORDS, column: 'id' } },
  targetNodeId: { type: 'text', nullable: true, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  sourceType: { type: 'text', nullable: true },
  sourceId: { type: 'text', nullable: true },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_NODE_SCOPES_SCHEMA = {
  nodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  addedAt: { type: 'timestamp', nullable: false },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_RECORD_SCOPES_SCHEMA = {
  recordId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_RECORDS, column: 'id' } },
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  addedAt: { type: 'timestamp', nullable: false },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_SCOPE_GRANTS_SCHEMA = {
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  scopeRefId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  role: { type: 'text', nullable: false },
  canSuggest: { type: 'boolean', nullable: true },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_ACCESS_STATE_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  epoch: { type: 'integer', nullable: false },
  schemaVersion: { type: 'integer', nullable: false },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_SCOPE_ADDRESSES_SCHEMA = {
  address: { type: 'text', nullable: false, primaryKey: true },
  scopeNodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_NODE_ADDRESSES_SCHEMA = {
  source: { type: 'text', nullable: false },
  address: { type: 'text', nullable: false },
  nodeId: { type: 'text', nullable: false, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_IMPORT_STATE_SCHEMA = {
  importerId: { type: 'text', nullable: false },
  binding: { type: 'text', nullable: false },
  key: { type: 'text', nullable: false },
  value: { type: 'text', nullable: false },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_IMPORT_RUNS_SCHEMA = {
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
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_V2_ACTIVITY_SCHEMA = {
  id: { type: 'text', nullable: false, primaryKey: true },
  action: { type: 'text', nullable: false },
  targetType: { type: 'text', nullable: true },
  targetId: { type: 'text', nullable: true },
  contextScopeId: { type: 'text', nullable: true, references: { table: TABLE_KNOWLEDGE_NODES, column: 'id' } },
  importRunId: { type: 'text', nullable: true, references: { table: TABLE_KNOWLEDGE_IMPORT_RUNS, column: 'id' } },
  details: { type: 'jsonb', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  recordType: { type: 'text', nullable: true },
  recordId: { type: 'text', nullable: true },
  scope: { type: 'jsonb', nullable: true },
  scopeKey: { type: 'text', nullable: true },
  sourceThreadId: { type: 'text', nullable: true },
} as const satisfies KnowledgeSchema;

export const KNOWLEDGE_PROPOSALS_SCHEMA = {
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
} as const satisfies KnowledgeSchema;

export type KnowledgeSchemaInspection =
  | { status: 'compatible'; schemaVersion: typeof KNOWLEDGE_STORAGE_SCHEMA_VERSION }
  | { status: 'uninitialized'; schemaVersion: null }
  | { status: 'incompatible-reset-required'; schemaVersion: number | null; reason: string }
  | { status: 'unavailable'; schemaVersion: null; reason: string };

export interface KnowledgeSchemaSnapshot {
  available: boolean;
  tableNames: readonly string[];
  schemaVersion?: number;
  reason?: string;
}

interface KnowledgeV2Core {
  assertKnowledgeDescriptionWithinBound(description: string | undefined): void;
  assertKnowledgeSchemaCompatible(inspection: KnowledgeSchemaInspection): void;
  inspectKnowledgeSchema(snapshot: KnowledgeSchemaSnapshot): KnowledgeSchemaInspection;
}

export function assertKnowledgeV2CoreSupport(features: ReadonlySet<string>): void {
  if (!features.has(KNOWLEDGE_V2_CORE_FEATURE)) {
    throw new Error(
      `Knowledge v2 requires @mastra/core >=${KNOWLEDGE_V2_MINIMUM_CORE_VERSION} with the "${KNOWLEDGE_V2_CORE_FEATURE}" feature`,
    );
  }
}

function resolveKnowledgeV2Core(storageModule: unknown): KnowledgeV2Core {
  if (typeof storageModule !== 'object' || storageModule === null) {
    throw new Error('@mastra/core advertises Knowledge v2 without the required storage API');
  }

  const {
    assertKnowledgeDescriptionWithinBound: assertDescription,
    assertKnowledgeSchemaCompatible: assertCompatible,
    inspectKnowledgeSchema: inspectSchema,
  } = storageModule as Record<string, unknown>;
  if (
    typeof assertDescription !== 'function' ||
    typeof assertCompatible !== 'function' ||
    typeof inspectSchema !== 'function'
  ) {
    throw new Error('@mastra/core advertises Knowledge v2 without the required storage API');
  }

  return {
    assertKnowledgeDescriptionWithinBound: description => assertDescription(description),
    assertKnowledgeSchemaCompatible: inspection => assertCompatible(inspection),
    inspectKnowledgeSchema: snapshot => inspectSchema(snapshot),
  };
}

export function createKnowledgeV2CoreLoader(
  features: ReadonlySet<string>,
  loadStorageModule: () => Promise<unknown>,
): () => Promise<KnowledgeV2Core> {
  let knowledgeV2Core: Promise<KnowledgeV2Core> | undefined;

  return async () => {
    assertKnowledgeV2CoreSupport(features);
    knowledgeV2Core ??= loadStorageModule()
      .then(resolveKnowledgeV2Core)
      .catch(error => {
        knowledgeV2Core = undefined;
        throw error;
      });
    return knowledgeV2Core;
  };
}
