export { mastraStorage } from './storage';

// Export live query functions for real-time subscriptions
export {
  // Live queries (reactive)
  watchThread,
  watchMessages,
  watchThreadsByResource,
  watchWorkflowRun,
  watchWorkflowRuns,
  watchResource,
  // Vector search
  vectorSearch,
  // Count queries
  countMessages,
  countThreads,
  countWorkflowRuns,
  // Paginated queries (cursor-based)
  paginatedMessages,
  paginatedThreads,
  paginatedWorkflowRuns,
} from './queries';

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
