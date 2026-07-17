export { mastraCache } from './cache';
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
  mastraSchedulesTable,
  mastraScheduleTriggersTable,
  mastraChannelInstallationsTable,
  mastraChannelConfigTable,
  mastraBackgroundTasksTable,
  mastraObservationalMemoryTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  defineMastraNativeVectorTable,
  type MastraNativeVectorTableConfig,
  mastraCacheTable,
  mastraCacheListItemsTable,
  mastraDocumentsTable,
  // Table name constants
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
  TABLE_OBSERVATIONAL_MEMORY,
} from '../schema';
