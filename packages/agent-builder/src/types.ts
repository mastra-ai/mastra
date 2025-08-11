import type { MastraLanguageModel, ToolsInput } from '@mastra/core/agent';

/**
 * Configuration options for the AgentBuilder
 */
export interface AgentBuilderConfig {
  /** The language model to use for agent generation */
  model: MastraLanguageModel;
  /** Storage provider for memory (required) */
  storage?: any;
  /** Vector provider for memory (optional) */
  vectorProvider?: any;
  /** Additional tools to include beyond the default set */
  tools?: ToolsInput;
  /** Custom instructions to append to the default system prompt */
  instructions?: string;
  /** Memory configuration options */
  memoryConfig?: {
    maxMessages?: number;
    tokenLimit?: number;
  };
  /** Project path */
  projectPath: string;
  /** Summary model */
  summaryModel?: MastraLanguageModel;
  /** Mode */
  mode?: 'template' | 'code-editor';
}

/**
 * Options for generating agents with AgentBuilder
 */
export interface GenerateAgentOptions {
  /** Runtime context for the generation */
  runtimeContext?: any;
  /** Output format preference */
  outputFormat?: 'code' | 'explanation' | 'both';
}

/**
 * Project management action types
 */
export type ProjectAction = 'create' | 'install' | 'upgrade' | 'check';

/**
 * Project types that can be created
 */
export type ProjectType = 'standalone' | 'api' | 'nextjs';

/**
 * Package manager options
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn';

/**
 * Validation types for code validation
 */
export type ValidationType = 'types' | 'schemas' | 'tests' | 'integration';
