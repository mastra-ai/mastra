// Re-export types from core
export type {
  ArtifactType,
  Artifact,
  FileArtifact,
  ImageArtifact,
  TextArtifact,
  AnyArtifact,
} from '@mastra/core/knowledge';

export { KnowledgeStorage } from '@mastra/core/knowledge';

export * from './knowledge';
export * from './storage';
export * from './processors';
export * from './bm25';
