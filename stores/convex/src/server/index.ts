export { mastraStorage } from './storage';
export { mastraNativeVectorAction, mastraNativeVectorMutation, mastraNativeVectorQuery } from './native-vector';

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
  defineMastraNativeVectorTable,
  type MastraNativeVectorTableConfig,
  mastraDocumentsTable,
  // Table name constants
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
} from '../schema';
