// Re-export the underlying client and error classes for convenience.
export {
  AgentMemory as AgentMemoryClient,
  AgentMemoryError,
  AuthError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  ScopeError,
  ServerError,
  ValidationError,
} from '@surrealdb/memory';
export type {
  AgentMemoryBaseConfig,
  AgentMemoryConfig,
  AgentMemoryCredentialsConfig,
  AgentMemoryInstanceConfig,
} from './config';
export { isAgentMemoryInstanceConfig } from './config';
export type { DocumentQueryMode } from './documents';
export { deleteDocument, ingestDocument, listDocuments, searchDocuments } from './documents';
export type { AgentMemoryExtractedContext, AgentMemoryExtractedSinkOptions } from './extractors';
export { agentMemoryExtractedSink } from './extractors';
export { AgentMemory } from './memory';
export type { AgentMemoryToolsOptions } from './tools';
export { createAgentMemoryTools } from './tools';
