// Public Oracle provider surface: Mastra imports storage, vector, schema export,
// and the shared pool manager from this entrypoint.
export * from './vector';
export * from './storage';
export * from './schema';
export { OraclePoolManager } from './shared/connection';
export type { OracleConnectionConfig } from './shared/connection';
export { ORACLEDB_PROMPT } from './vector/prompt';
