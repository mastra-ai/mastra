export { ConvexStore, type ConvexStoreConfig } from './storage';
export { ConvexVector, type ConvexVectorConfig } from './vector';

// Export domain classes for standalone usage
export { MemoryConvex, ScoresConvex, WorkflowsConvex } from './storage';

// Export client for advanced usage
export { ConvexAdminClient, type ConvexAdminClientConfig } from './storage/client';

// Re-export commonly used constants and helpers
export { COMMON_EMBEDDING_DIMENSIONS, createVectorTable } from './schema';

// Re-export server components (storage mutation, queries, schema)
export * from './server';
