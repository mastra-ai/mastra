/**
 * @mastra/convex/schema
 * 
 * Pure table definitions for Convex schema files.
 * This export contains only Convex-compatible table definitions
 * that can be imported in Convex schema.ts files.
 * 
 * Unlike @mastra/convex/server, this export does not include
 * runtime dependencies and can be safely imported in Convex's
 * isolated schema evaluation environment.
 */

import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// ============================================================================
// Core Mastra Tables
// ============================================================================

/**
 * Threads table - stores conversation threads
 */
export const mastraThreadsTable = defineTable({
  id: v.string(),
  resourceId: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_resource', ['resourceId'])
  .index('by_created', ['createdAt'])
  .index('by_updated', ['updatedAt']);

/**
 * Messages table - stores conversation messages
 */
export const mastraMessagesTable = defineTable({
  id: v.string(),
  thread_id: v.string(),
  content: v.string(),
  role: v.string(),
  type: v.string(),
  createdAt: v.string(),
  resourceId: v.optional(v.string()),
})
  .index('by_record_id', ['id'])
  .index('by_thread', ['thread_id'])
  .index('by_thread_created', ['thread_id', 'createdAt'])
  .index('by_resource', ['resourceId']);

/**
 * Resources table - stores resource/user working memory
 */
export const mastraResourcesTable = defineTable({
  id: v.string(),
  data: v.any(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_updated', ['updatedAt']);

/**
 * Workflow snapshots table - stores workflow execution state
 */
export const mastraWorkflowSnapshotsTable = defineTable({
  id: v.string(),
  workflow_name: v.string(),
  run_id: v.string(),
  state: v.any(),
  createdAt: v.string(),
  resourceId: v.optional(v.string()),
})
  .index('by_record_id', ['id'])
  .index('by_workflow_run', ['workflow_name', 'run_id'])
  .index('by_workflow', ['workflow_name'])
  .index('by_resource', ['resourceId'])
  .index('by_created', ['createdAt']);

/**
 * Scores table - stores evaluation scores
 */
export const mastraScoresTable = defineTable({
  id: v.string(),
  scorerId: v.string(),
  entityId: v.string(),
  entityType: v.string(),
  score: v.number(),
  runId: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_scorer', ['scorerId'])
  .index('by_entity', ['entityId', 'entityType'])
  .index('by_run', ['runId'])
  .index('by_created', ['createdAt']);

// ============================================================================
// Vector Tables
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
 */
export const mastraVectorsTable = defineTable({
  id: v.string(), // Mastra record ID
  indexName: v.string(),
  embedding: v.array(v.float64()),
  metadata: v.optional(v.any()),
})
  .index('by_index_id', ['indexName', 'id'])
  .index('by_index', ['indexName']);

// ============================================================================
// Generic Documents Table
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
// Table Name Constants
// ============================================================================

/**
 * Table name constants for convenience
 */
export const TABLE_WORKFLOW_SNAPSHOT = 'mastra_workflow_snapshots';
export const TABLE_MESSAGES = 'mastra_messages';
export const TABLE_THREADS = 'mastra_threads';
export const TABLE_RESOURCES = 'mastra_resources';
export const TABLE_SCORERS = 'mastra_scores';
