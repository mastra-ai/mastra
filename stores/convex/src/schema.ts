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
 */
export const mastraWorkflowSnapshotsTable = defineTable(buildTableFromSchema(TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT]))
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

export { TABLE_WORKFLOW_SNAPSHOT, TABLE_MESSAGES, TABLE_THREADS, TABLE_RESOURCES, TABLE_SCORERS };

// Additional table name constants for vector tables (not in core)
export const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
export const TABLE_VECTORS = 'mastra_vectors';
export const TABLE_DOCUMENTS = 'mastra_documents';
