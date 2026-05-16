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
})
  .index('by_record_id', ['id'])
  .index('by_status_next_fire_at', ['status', 'next_fire_at'])
  .index('by_owner', ['owner_type', 'owner_id'])
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
};

// Additional table name constants for vector tables (not in core)
export const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
export const TABLE_VECTORS = 'mastra_vectors';
export const TABLE_DOCUMENTS = 'mastra_documents';
