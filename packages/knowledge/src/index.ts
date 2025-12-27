// Re-export types from core
export type {
  ArtifactType,
  Artifact,
  FileArtifact,
  ImageArtifact,
  TextArtifact,
  AnyArtifact,
  MastraKnowledge,
  KnowledgeSearchMode,
  KnowledgeSearchResult as CoreKnowledgeSearchResult,
  KnowledgeSearchOptions as CoreKnowledgeSearchOptions,
} from '@mastra/core/knowledge';

export { KnowledgeStorage } from '@mastra/core/knowledge';

export * from './knowledge';
export * from './storage';
export * from './processors';
export * from './bm25';
