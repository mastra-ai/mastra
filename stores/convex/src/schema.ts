import { defineTable } from 'convex/server';
import { v } from 'convex/values';


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

export const mastraResourcesTable = defineTable({
  id: v.string(),
  data: v.any(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_updated', ['updatedAt']);


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

export const mastraVectorIndexesTable = defineTable({
  id: v.string(), // Mastra record ID (same as indexName)
  indexName: v.string(),
  dimension: v.number(),
  metric: v.string(),
  createdAt: v.string(),
})
  .index('by_record_id', ['id'])
  .index('by_name', ['indexName']);


export const mastraVectorsTable = defineTable({
  id: v.string(), // Mastra record ID
  indexName: v.string(),
  embedding: v.array(v.float64()),
  metadata: v.optional(v.any()),
})
  .index('by_index_id', ['indexName', 'id'])
  .index('by_index', ['indexName']);


export const mastraDocumentsTable = defineTable({
  table: v.string(),
  primaryKey: v.string(),
  record: v.any(),
})
  .index('by_table', ['table'])
  .index('by_table_primary', ['table', 'primaryKey']);


export const TABLE_WORKFLOW_SNAPSHOT = 'mastra_workflow_snapshots';
export const TABLE_MESSAGES = 'mastra_messages';
export const TABLE_THREADS = 'mastra_threads';
export const TABLE_RESOURCES = 'mastra_resources';
export const TABLE_SCORERS = 'mastra_scores';
export const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
export const TABLE_VECTORS = 'mastra_vectors';
export const TABLE_DOCUMENTS = 'mastra_documents';
