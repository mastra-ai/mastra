
export { mastraStorage } from './storage';

// Re-export schema definitions for backward compatibility
// @mastra/convex/server now re-exports from @mastra/convex/schema
export {
  // Table definitions
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraDocumentsTable,
  // Table name constants
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
} from '../schema';
