export { Mastra, type Config } from './mastra';

// Re-export types needed by editor package // trigger CI
export { Agent } from './agent';
export type { SharedMemoryConfig, MemoryConfig, MastraMemory, SerializedMemoryConfig } from './memory';
export type { MastraVector as MastraVectorProvider } from './vector';
export type { IMastraLogger as Logger } from './logger';
export type { ToolAction } from './tools';
export type { AnyWorkflow, Workflow } from './workflows';
export type { MastraScorers, ScoringSamplingConfig } from './evals';
export type { StorageResolvedAgentType, StorageScorerConfig, StorageToolConfig } from './storage';
export type {
  IMastraEditor,
  MastraEditorConfig,
  IEditorAgentNamespace,
  IEditorPromptNamespace,
  IEditorScorerNamespace,
} from './editor';
