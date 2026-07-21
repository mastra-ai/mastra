/**
 * Convex schema definitions for Mastra tables.
 *
 * This file dynamically builds Convex table definitions from the canonical
 * TABLE_SCHEMAS in @mastra/core/storage/constants to ensure they stay in sync.
 *
 * The import path @mastra/core/storage/constants is specifically designed to
 * avoid pulling in Node.js dependencies, making it safe to use in Convex's
 * sandboxed schema evaluation environment.
 */
import {
  TABLE_SCHEMAS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_BACKGROUND_TASKS,
} from '@mastra/core/storage/constants';
import { defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Helper to convert Mastra StorageColumn type to Convex validator
 */
function columnToValidator(column: { type: string; nullable?: boolean }) {
  let validator;
  switch (column.type) {
    case 'text':
      validator = v.string();
      break;
    case 'integer':
    case 'float':
      validator = v.number();
      break;
    case 'bigint':
      validator = v.int64();
      break;
    case 'boolean':
      validator = v.boolean();
      break;
    case 'timestamp':
      validator = v.string(); // Store as ISO string
      break;
    case 'jsonb':
    case 'json':
      validator = v.any();
      break;
    default:
      validator = v.any();
  }
  return column.nullable ? v.optional(validator) : validator;
}

/**
 * Build Convex table definition from Mastra schema.
 * Includes the `id` field as a regular field (Convex auto-generates _id).
 */
function buildTableFromSchema(schema: Record<string, { type: string; nullable?: boolean; primaryKey?: boolean }>) {
  const fields: Record<string, any> = {};
  for (const [key, column] of Object.entries(schema)) {
    fields[key] = columnToValidator(column);
  }
  return fields;
}

// ============================================================================
// Table Definitions - Built from @mastra/core TABLE_SCHEMAS
// ============================================================================

/**
 * Threads table - stores conversation threads
 * Schema: TABLE_SCHEMAS[TABLE_THREADS]
 */
export const mastraThreadsTable = defineTable(buildTableFromSchema(TABLE_SCHEMAS[TABLE_THREADS]))
  .index('by_record_id', ['id'])
  .index('by_resource', ['resourceId'])
  .index('by_created', ['createdAt'])
  .index('by_updated', ['updatedAt']);

/**
 * Messages table - stores conversation messages
 * Schema: TABLE_SCHEMAS[TABLE_MESSAGES]
 */
export const mastraMessagesTable = defineTable(buildTableFromSchema(TABLE_SCHEMAS[TABLE_MESSAGES]))
  .index('by_record_id', ['id'])
  .index('by_thread', ['thread_id'])
  .index('by_thread_created', ['thread_id', 'createdAt'])
  .index('by_resource', ['resourceId']);

/**
 * Resources table - stores resource/user working memory
 * Schema: TABLE_SCHEMAS[TABLE_RESOURCES]
 */
export const mastraResourcesTable = defineTable(buildTableFromSchema(TABLE_SCHEMAS[TABLE_RESOURCES]))
  .index('by_record_id', ['id'])
  .index('by_updated', ['updatedAt']);

/**
 * Workflow snapshots table - stores workflow execution state
 * Schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT]
 *
 * Note: The `id` field is added explicitly for Convex's by_record_id index.
 * The core schema uses (workflow_name, run_id) as a composite key, but Convex
 * requires a single-column index. The id value is generated at runtime as
 * `${workflow_name}-${run_id}` by the Convex storage adapter's normalizeRecord().
 *
 * Fields are defined explicitly (not using buildTableFromSchema) because TypeScript's
 * type inference doesn't work well with spread operators in Convex's defineTable.
 */
export const mastraWorkflowSnapshotsTable = defineTable({
  id: v.optional(v.string()), // Synthetic ID for Convex index, generated at runtime
  workflow_name: v.string(),
  run_id: v.string(),
  resourceId: v.optional(v.string()),
  snapshot: v.any(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_workflow_run', ['workflow_name', 'run_id'])
  .index('by_workflow', ['workflow_name'])
  .index('by_resource', ['resourceId'])
  .index('by_created', ['createdAt']);

/**
 * Scores table - stores evaluation scores
 * Schema: TABLE_SCHEMAS[TABLE_SCORERS]
 */
export const mastraScoresTable = defineTable(buildTableFromSchema(TABLE_SCHEMAS[TABLE_SCORERS]))
  .index('by_record_id', ['id'])
  .index('by_scorer', ['scorerId'])
  .index('by_entity', ['entityId', 'entityType'])
  .index('by_run', ['runId'])
  .index('by_created', ['createdAt']);

/**
 * Schedules table - stores workflow scheduler state.
 *
 * Schedule times are represented as JavaScript millisecond timestamps. Target
 * and metadata payloads are serialized JSON strings because user-provided JSON
 * can contain Convex-reserved field names such as `$schema`.
 */
export const mastraSchedulesTable = defineTable({
  id: v.string(),
  target: v.string(),
  cron: v.string(),
  timezone: v.optional(v.union(v.string(), v.null())),
  status: v.string(),
  next_fire_at: v.number(),
  last_fire_at: v.optional(v.union(v.number(), v.null())),
  last_run_id: v.optional(v.union(v.string(), v.null())),
  created_at: v.number(),
  updated_at: v.number(),
  metadata: v.optional(v.union(v.string(), v.null())),
  owner_type: v.optional(v.union(v.string(), v.null())),
  owner_id: v.optional(v.union(v.string(), v.null())),
  workflow_id: v.optional(v.union(v.string(), v.null())),
})
  .index('by_record_id', ['id'])
  .index('by_status_next_fire_at', ['status', 'next_fire_at'])
  .index('by_workflow_status', ['workflow_id', 'status'])
  .index('by_workflow_id', ['workflow_id'])
  .index('by_owner', ['owner_type', 'owner_id'])
  .index('by_owner_id', ['owner_id'])
  .index('by_created', ['created_at']);

/**
 * Schedule trigger table - stores scheduler trigger history.
 */
export const mastraScheduleTriggersTable = defineTable({
  id: v.string(),
  schedule_id: v.string(),
  run_id: v.optional(v.union(v.string(), v.null())),
  scheduled_fire_at: v.number(),
  actual_fire_at: v.number(),
  outcome: v.string(),
  error: v.optional(v.union(v.string(), v.null())),
  trigger_kind: v.string(),
  parent_trigger_id: v.optional(v.union(v.string(), v.null())),
  metadata: v.optional(v.union(v.string(), v.null())),
})
  .index('by_record_id', ['id'])
  .index('by_schedule_actual', ['schedule_id', 'actual_fire_at'])
  .index('by_parent_trigger', ['parent_trigger_id']);

/**
 * Channel installations table - stores platform app installations for agents.
 *
 * Platform data is serialized as a JSON string because user/platform payloads
 * can contain Convex-reserved field names such as `$schema`.
 */
export const mastraChannelInstallationsTable = defineTable({
  id: v.string(),
  platform: v.string(),
  agentId: v.string(),
  status: v.string(),
  webhookId: v.optional(v.union(v.string(), v.null())),
  data: v.string(),
  configHash: v.optional(v.union(v.string(), v.null())),
  error: v.optional(v.union(v.string(), v.null())),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_webhook', ['webhookId'])
  .index('by_platform_agent', ['platform', 'agentId'])
  .index('by_platform', ['platform']);

/**
 * Channel config table - stores platform-level channel configuration.
 *
 * The synthetic id mirrors `platform` so the generic Convex storage operations
 * can use their existing by-record-id lookup path.
 */
export const mastraChannelConfigTable = defineTable({
  id: v.string(),
  platform: v.string(),
  data: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_platform', ['platform']);

/**
 * Background tasks table - stores durable background task state.
 *
 * JSON-like payloads are stored as encoded strings to match the existing
 * Convex storage serialization used by this adapter.
 *
 * Optional fields are stored as null when cleared so partial Convex patches can
 * preserve the existing task row while explicitly removing suspended state.
 */
export const mastraBackgroundTasksTable = defineTable({
  id: v.string(),
  tool_call_id: v.string(),
  tool_name: v.string(),
  agent_id: v.string(),
  run_id: v.string(),
  thread_id: v.union(v.string(), v.null()),
  resource_id: v.union(v.string(), v.null()),
  status: v.union(
    v.literal('pending'),
    v.literal('running'),
    v.literal('suspended'),
    v.literal('completed'),
    v.literal('failed'),
    v.literal('cancelled'),
    v.literal('timed_out'),
  ),
  args: v.string(),
  result: v.union(v.string(), v.null()),
  error: v.union(v.string(), v.null()),
  suspend_payload: v.union(v.string(), v.null()),
  retry_count: v.number(),
  max_retries: v.number(),
  timeout_ms: v.number(),
  createdAt: v.string(),
  startedAt: v.union(v.string(), v.null()),
  suspendedAt: v.union(v.string(), v.null()),
  completedAt: v.union(v.string(), v.null()),
})
  .index('by_record_id', ['id'])
  .index('by_status_created', ['status', 'createdAt'])
  .index('by_agent_status', ['agent_id', 'status'])
  .index('by_run', ['run_id'])
  .index('by_tool_call', ['tool_call_id'])
  .index('by_thread', ['thread_id'])
  .index('by_resource', ['resource_id'])
  .index('by_tool', ['tool_name'])
  .index('by_created', ['createdAt']);

/**
 * Observational memory table - stores observational memory generations.
 *
 * Fields mirror @mastra/core's OBSERVATIONAL_MEMORY_SCHEMA (storage/constants.ts).
 * The schema is defined explicitly (not via buildTableFromSchema) because the
 * core export is intentionally excluded from TABLE_SCHEMAS (OM is optional) and
 * older cores in the peer range may not export it at all.
 *
 * Serialization conventions:
 * - Timestamps are ISO strings.
 * - `config`, `metadata`, and `bufferedObservationChunks` are JSON strings
 *   because user-influenced payloads can contain Convex-reserved field names
 *   such as `$schema` (same reasoning as mastraSchedulesTable).
 * - Nullable fields accept explicit null so cleared state can travel over JSON.
 *
 * Records are keyed by `lookupKey` ('thread:{id}' or 'resource:{id}'); the
 * latest generation is the highest `generationCount` per lookupKey, served by
 * the by_lookup_key index in descending order.
 */
export const mastraObservationalMemoryTable = defineTable({
  id: v.string(),
  lookupKey: v.string(),
  scope: v.string(),
  // Nullable in core's OBSERVATIONAL_MEMORY_SCHEMA; the adapter always writes it.
  resourceId: v.optional(v.union(v.string(), v.null())),
  threadId: v.optional(v.union(v.string(), v.null())),
  activeObservations: v.string(),
  activeObservationsPendingUpdate: v.optional(v.union(v.string(), v.null())),
  originType: v.string(),
  config: v.string(),
  generationCount: v.number(),
  lastObservedAt: v.optional(v.union(v.string(), v.null())),
  lastReflectionAt: v.optional(v.union(v.string(), v.null())),
  pendingMessageTokens: v.number(),
  totalTokensObserved: v.number(),
  observationTokenCount: v.number(),
  isObserving: v.boolean(),
  isReflecting: v.boolean(),
  observedMessageIds: v.optional(v.union(v.array(v.string()), v.null())),
  observedTimezone: v.optional(v.union(v.string(), v.null())),
  bufferedObservations: v.optional(v.union(v.string(), v.null())),
  bufferedObservationTokens: v.optional(v.union(v.number(), v.null())),
  bufferedMessageIds: v.optional(v.union(v.array(v.string()), v.null())),
  bufferedReflection: v.optional(v.union(v.string(), v.null())),
  bufferedReflectionTokens: v.optional(v.union(v.number(), v.null())),
  bufferedReflectionInputTokens: v.optional(v.union(v.number(), v.null())),
  reflectedObservationLineCount: v.optional(v.union(v.number(), v.null())),
  bufferedObservationChunks: v.optional(v.union(v.string(), v.null())),
  isBufferingObservation: v.boolean(),
  isBufferingReflection: v.boolean(),
  lastBufferedAtTokens: v.number(),
  lastBufferedAtTime: v.optional(v.union(v.string(), v.null())),
  metadata: v.optional(v.union(v.string(), v.null())),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_lookup_key', ['lookupKey', 'generationCount']);

// ============================================================================
// Vector Tables - Not in core schemas (vector-specific)
// ============================================================================

/**
 * Vector indexes table - stores metadata about vector indexes
 */
export const mastraVectorIndexesTable = defineTable({
  id: v.string(), // Mastra record ID (same as indexName)
  indexName: v.string(),
  dimension: v.number(),
  metric: v.string(),
  createdAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_name', ['indexName']);

/**
 * Vectors table - stores vector embeddings
 * Uses indexName field to support multiple indexes with different dimensions
 */
export const mastraVectorsTable = defineTable({
  id: v.string(), // Mastra record ID
  indexName: v.string(),
  embedding: v.array(v.float64()),
  metadata: v.optional(v.any()),
})
  .index('by_index_id', ['indexName', 'id']) // Composite for scoped lookups per index
  .index('by_index', ['indexName']);

export type MastraNativeVectorTableConfig = {
  /**
   * Vector dimensions for the deployed Convex vector index.
   */
  dimensions: number;
  /**
   * Convex vector index name.
   *
   * @default 'by_embedding'
   */
  vectorIndexName?: string;
  /**
   * Stage the vector index for a later backfill.
   *
   * @default false
   */
  staged?: boolean;
};

/**
 * Defines a dedicated Convex table for native vector search with the default
 * `ConvexNativeVector` field names.
 *
 * Use a custom `defineTable()` when you need native vector `filterFields`,
 * because filter fields must also be declared in the table schema.
 */
export function defineMastraNativeVectorTable({
  dimensions,
  vectorIndexName = 'by_embedding',
  staged = false,
}: MastraNativeVectorTableConfig) {
  if (!Number.isInteger(dimensions) || dimensions < 2 || dimensions > 4096) {
    throw new Error('defineMastraNativeVectorTable: dimensions must be an integer between 2 and 4096.');
  }

  const table = defineTable({
    id: v.string(),
    embedding: v.array(v.float64()),
    metadata: v.optional(v.any()),
  }).index('by_record_id', ['id']);

  if (staged) {
    return table.vectorIndex(vectorIndexName, {
      vectorField: 'embedding',
      dimensions,
      staged: true,
    });
  }

  return table.vectorIndex(vectorIndexName, {
    vectorField: 'embedding',
    dimensions,
  });
}

// ============================================================================
// Server Cache Tables - Used by ConvexServerCache
// ============================================================================

/**
 * Cache metadata table - stores scalar cache values, list counters, and numeric
 * counters used by ConvexServerCache.
 */
export const mastraCacheTable = defineTable({
  key: v.string(),
  keyPrefix: v.string(),
  kind: v.union(v.literal('value'), v.literal('list'), v.literal('counter'), v.literal('deleted')),
  value: v.optional(v.string()),
  counter: v.optional(v.number()),
  expiresAt: v.union(v.number(), v.null()),
})
  .index('by_key', ['key'])
  .index('by_key_prefix', ['keyPrefix']);

/**
 * Cache list item table - stores each list entry as its own row so replay
 * history does not grow into a single large Convex document.
 */
export const mastraCacheListItemsTable = defineTable({
  key: v.string(),
  keyPrefix: v.string(),
  index: v.number(),
  value: v.string(),
})
  .index('by_key_prefix', ['keyPrefix'])
  .index('by_key_index', ['key', 'index']);

// ============================================================================
// Fallback Table - For unknown/custom tables
// ============================================================================

/**
 * Generic documents table - fallback for unknown table types
 */
export const mastraDocumentsTable = defineTable({
  table: v.string(),
  primaryKey: v.string(),
  record: v.any(),
})
  .index('by_table', ['table'])
  .index('by_table_primary', ['table', 'primaryKey']);

// ============================================================================
// Re-export table name constants for convenience
// ============================================================================

export {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_BACKGROUND_TASKS,
};

// Additional table name constants for vector tables (not in core)
export const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
export const TABLE_VECTORS = 'mastra_vectors';
export const TABLE_DOCUMENTS = 'mastra_documents';

// Observational memory table name. Defined locally (not imported from core)
// because this file is bundled into the user's Convex deployment and must not
// rely on value exports that older @mastra/core versions in the peer range lack.
export const TABLE_OBSERVATIONAL_MEMORY = 'mastra_observational_memory';
