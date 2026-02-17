import type { Agent } from '../agent';
import type { MastraScorer } from '../evals';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { ProcessorProvider } from '../processor-provider';
import type { RequestContext } from '../request-context';
import type {
  AgentInstructionBlock,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput,
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
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  StorageResolvedMCPClientType,
  StorageListMCPClientsResolvedOutput,
} from '../storage/types';
import type { ToolProvider } from '../tool-provider';

export interface MastraEditorConfig {
  logger?: IMastraLogger;
  /** Tool providers for integration tools (e.g., Composio) */
  toolProviders?: Record<string, ToolProvider>;
  /** Processor providers for configurable processors (e.g., moderation, token limiter) */
  processorProviders?: Record<string, ProcessorProvider>;
}

export interface GetByIdOptions {
  /** Retrieve a specific version by ID. */
  versionId?: string;
  /** Retrieve a specific version by number. */
  versionNumber?: number;
}

// ============================================================================
// Agent Namespace Interface
// ============================================================================

export interface IEditorAgentNamespace {
  create(input: StorageCreateAgentInput): Promise<Agent>;
  getById(id: string, options?: GetByIdOptions): Promise<Agent | null>;
  update(input: StorageUpdateAgentInput): Promise<Agent>;
  delete(id: string): Promise<void>;
  list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput>;
  listResolved(args?: StorageListAgentsInput): Promise<StorageListAgentsResolvedOutput>;
  clearCache(agentId?: string): void;
  clone(
    agent: Agent,
    options: {
      newId: string;
      newName?: string;
      metadata?: Record<string, unknown>;
      authorId?: string;
      requestContext?: RequestContext;
    },
  ): Promise<StorageResolvedAgentType>;
}

// ============================================================================
// Prompt Namespace Interface
// ============================================================================

export interface IEditorPromptNamespace {
  create(input: StorageCreatePromptBlockInput): Promise<StorageResolvedPromptBlockType>;
  getById(id: string, options?: GetByIdOptions): Promise<StorageResolvedPromptBlockType | null>;
  update(input: StorageUpdatePromptBlockInput): Promise<StorageResolvedPromptBlockType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput>;
  listResolved(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksResolvedOutput>;
  clearCache(id?: string): void;
  preview(blocks: AgentInstructionBlock[], context: Record<string, unknown>): Promise<string>;
}

// ============================================================================
// Scorer Namespace Interface
// ============================================================================

export interface IEditorScorerNamespace {
  create(input: StorageCreateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType>;
  getById(id: string, options?: GetByIdOptions): Promise<StorageResolvedScorerDefinitionType | null>;
  update(input: StorageUpdateScorerDefinitionInput): Promise<StorageResolvedScorerDefinitionType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput>;
  listResolved(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsResolvedOutput>;
  clearCache(id?: string): void;
  resolve(storedScorer: StorageResolvedScorerDefinitionType): MastraScorer<any, any, any, any> | null;
}

// ============================================================================
// MCP Config Namespace Interface
// ============================================================================

export interface IEditorMCPNamespace {
  create(input: StorageCreateMCPClientInput): Promise<StorageResolvedMCPClientType>;
  getById(id: string, options?: GetByIdOptions): Promise<StorageResolvedMCPClientType | null>;
  update(input: StorageUpdateMCPClientInput): Promise<StorageResolvedMCPClientType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput>;
  listResolved(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsResolvedOutput>;
  clearCache(id?: string): void;
}

// ============================================================================
// Main Editor Interface
// ============================================================================

/**
 * Interface for the Mastra Editor, which handles agent, prompt, scorer,
 * and MCP config management from stored data.
 */
export interface IMastraEditor {
  /**
   * Register this editor with a Mastra instance.
   * This gives the editor access to Mastra's storage, tools, workflows, etc.
   */
  registerWithMastra(mastra: Mastra): void;

  /** Agent management namespace */
  readonly agent: IEditorAgentNamespace;

  /** MCP config management namespace */
  readonly mcp: IEditorMCPNamespace;

  /** Prompt block management namespace */
  readonly prompt: IEditorPromptNamespace;

  /** Scorer definition management namespace */
  readonly scorer: IEditorScorerNamespace;

  /** Registered tool providers */
  getToolProvider(id: string): ToolProvider | undefined;
  /** List all registered tool providers */
  getToolProviders(): Record<string, ToolProvider>;

  /** Get a processor provider by ID */
  getProcessorProvider(id: string): ProcessorProvider | undefined;
  /** List all registered processor providers */
  listProcessorProviders(): Record<string, ProcessorProvider>;
}
