import type { Agent } from '../agent';
import type { MastraScorer } from '../evals';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type {
  AgentInstructionBlock,
  StorageResolvedAgentType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageResolvedPromptBlockType,
  StorageListPromptBlocksResolvedOutput,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageResolvedScorerDefinitionType,
  StorageListScorerDefinitionsResolvedOutput,
} from '../storage/types';

export interface MastraEditorConfig {
  logger?: IMastraLogger;
}

// ============================================================================
// Agent Namespace Interface
// ============================================================================

export interface IEditorAgentNamespace {
  getById(
    id: string,
    options?: { returnRaw?: false; versionId?: string; versionNumber?: number },
  ): Promise<Agent | null>;

  getById(
    id: string,
    options: { returnRaw: true; versionId?: string; versionNumber?: number },
  ): Promise<StorageResolvedAgentType | null>;

  list(options?: { returnRaw?: false; page?: number; pageSize?: number }): Promise<{
    agents: Agent[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;

  list(options: { returnRaw: true; page?: number; pageSize?: number }): Promise<{
    agents: StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;

  clearCache(agentId?: string): void;
}

// ============================================================================
// Prompt Namespace Interface
// ============================================================================

export interface IEditorPromptNamespace {
  create(input: StorageCreatePromptBlockInput): Promise<StorageResolvedPromptBlockType>;
  getById(id: string): Promise<StorageResolvedPromptBlockType | null>;
  update(input: StorageUpdatePromptBlockInput): Promise<StorageResolvedPromptBlockType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput>;
  listResolved(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksResolvedOutput>;
  preview(blocks: AgentInstructionBlock[], context: Record<string, unknown>): Promise<string>;
}

// ============================================================================
// Scorer Namespace Interface
// ============================================================================

export interface IEditorScorerNamespace {
  create(input: StorageCreateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType>;
  getById(id: string): Promise<StorageResolvedScorerDefinitionType | null>;
  update(input: StorageUpdateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput>;
  listResolved(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsResolvedOutput>;
  resolve(storedScorer: StorageResolvedScorerDefinitionType): MastraScorer<any, any, any, any> | null;
}

// ============================================================================
// Main Editor Interface
// ============================================================================

/**
 * Interface for the Mastra Editor, which handles agent, prompt, and scorer
 * management from stored data.
 */
export interface IMastraEditor {
  /**
   * Register this editor with a Mastra instance.
   * This gives the editor access to Mastra's storage, tools, workflows, etc.
   */
  registerWithMastra(mastra: Mastra): void;

  /** Agent management namespace */
  readonly agent: IEditorAgentNamespace;

  /** Prompt block management namespace */
  readonly prompt: IEditorPromptNamespace;

  /** Scorer definition management namespace */
  readonly scorer: IEditorScorerNamespace;
}
