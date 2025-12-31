// Re-export types from core (skills)
export type {
  SkillFormat,
  SkillMetadata,
  Skill,
  SkillSource,
  SkillSearchResult,
  SkillSearchOptions,
  MastraSkills,
} from '@mastra/core/skills';

export { SkillsStorage, type ListSkillsOptions } from '@mastra/core/skills';

// Re-export types from core (knowledge)
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

// Local types
export type { SkillsConfig } from './types';

// Skills class (SKILL.md based)
export { Skills, type SkillsBM25Config } from './skills';

// Knowledge class (namespace/artifact based)
export * from './knowledge';

// Processors (Skills)
export { SkillsProcessor, type SkillsProcessorOptions } from './processors/skills';
export { StaticSkills, type StaticSkillsOptions } from './processors/static-skills';
export { RetrievedSkills, type RetrievedSkillsOptions } from './processors/retrieved-skills';

// Processors (Knowledge)
export { StaticKnowledge, type StaticKnowledgeOptions } from './processors/static-knowledge';
export { RetrievedKnowledge, type RetrievedKnowledgeOptions } from './processors/retrieved-knowledge';

// Storage (Skills)
export { FilesystemStorage, type FilesystemStorageOptions } from './storage/filesystem';

// Storage (Knowledge)
export { KnowledgeFilesystemStorage } from './storage';

// BM25 (for advanced use cases)
export {
  BM25Index,
  tokenize,
  DEFAULT_STOPWORDS,
  type BM25Config,
  type BM25Document,
  type BM25SearchResult,
  type BM25IndexData,
  type TokenizeOptions,
} from './bm25';
