/**
 * Convex Schema for Mastra
 *
 * Copy this to your `convex/schema.ts` file.
 */

import { defineSchema } from 'convex/server';
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraDocumentsTable,
  createVectorTable,
  COMMON_EMBEDDING_DIMENSIONS,
} from '@mastra/convex/schema';

export default defineSchema({
  // Mastra tables
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_documents: mastraDocumentsTable,

  // Vector table with native search (for RAG)
  mastra_vectors: createVectorTable(COMMON_EMBEDDING_DIMENSIONS.OPENAI_ADA_002),
});
