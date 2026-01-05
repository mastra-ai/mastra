/**
 * Example Convex Schema for Mastra
 *
 * Copy this to your `convex/schema.ts` file and customize as needed.
 */

import { defineSchema } from 'convex/server';
import {
  // Table definitions
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraDocumentsTable,

  // Vector table helper (with native search)
  createVectorTable,

  // Common embedding dimensions
  COMMON_EMBEDDING_DIMENSIONS,
} from '@mastra/convex/schema';

/**
 * Option 1: Basic Schema (no native vector search)
 *
 * Use this if you don't need vector search or want to start simple.
 * Vector search will use brute-force server-side similarity calculation.
 */
export const basicSchema = defineSchema({
  // Core Mastra tables
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,

  // Vector tables (without native vector search)
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraDocumentsTable, // Falls back to documents table

  // Fallback table for custom data
  mastra_documents: mastraDocumentsTable,
});

/**
 * Option 2: Schema with Native Vector Search (Recommended)
 *
 * Use the `createVectorTable` helper to enable native vector search.
 * This provides much faster similarity search at scale.
 */
export const schemaWithVectorSearch = defineSchema({
  // Core Mastra tables
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,

  // Vector tables with NATIVE vector search (uses HNSW index)
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: createVectorTable(COMMON_EMBEDDING_DIMENSIONS.OPENAI_ADA_002),

  // Fallback table
  mastra_documents: mastraDocumentsTable,
});

/**
 * Option 3: Schema with Multiple Vector Dimensions
 *
 * If you use different embedding models with different dimensions,
 * you can create multiple vector tables.
 */
export const schemaWithMultipleVectors = defineSchema({
  // Core Mastra tables
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_documents: mastraDocumentsTable,

  // Multiple vector tables for different embedding models
  mastra_vectors: createVectorTable(1536), // OpenAI ada-002, 3-small
  mastra_vectors_large: createVectorTable(3072), // OpenAI 3-large
  mastra_vectors_cohere: createVectorTable(1024), // Cohere
});

/**
 * Available embedding dimensions:
 *
 * COMMON_EMBEDDING_DIMENSIONS.OPENAI_ADA_002  = 1536
 * COMMON_EMBEDDING_DIMENSIONS.OPENAI_3_SMALL  = 1536
 * COMMON_EMBEDDING_DIMENSIONS.OPENAI_3_LARGE  = 3072
 * COMMON_EMBEDDING_DIMENSIONS.COHERE_V3       = 1024
 * COMMON_EMBEDDING_DIMENSIONS.VOYAGE_02       = 1024
 */

// Export the schema you want to use
export default schemaWithVectorSearch;
