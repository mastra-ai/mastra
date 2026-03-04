import type { Agent } from '../agent';
import type { MastraScorer } from '../evals';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MCPServerBase } from '../mcp';
import type { ProcessorProvider } from '../processor-provider';
import type { RequestContext } from '../request-context';
import type { BlobStore } from '../storage/domains/blobs/base';
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
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  StorageResolvedWorkspaceType,
  StorageListWorkspacesResolvedOutput,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
  StorageListMCPServersResolvedOutput,
  StorageCreateSkillInput,
  StorageUpdateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  StorageResolvedSkillType,
  StorageListSkillsResolvedOutput,
} from '../storage/types';
import type { ToolProvider } from '../tool-provider';
import type { WorkspaceFilesystem } from '../workspace/filesystem/filesystem';
import type { WorkspaceSandbox } from '../workspace/sandbox/sandbox';

// ============================================================================
// Workspace Provider Interfaces
// ============================================================================

/**
 * A registered filesystem provider that the editor can use to hydrate
 * stored workspace filesystem configs into runtime instances.
 *
 * Built-in providers (e.g., local) are auto-registered. External providers
 * (e.g., S3, GCS) should be passed to `MastraEditorConfig.filesystems`.
 */
export interface FilesystemProvider<TConfig = Record<string, unknown>> {
  /** Unique provider identifier (e.g., 'local', 's3', 'gcs') — matches `StorageFilesystemConfig.provider` */
  id: string;
  /** Human-readable name for UI display */
  name: string;
  /** Short description for UI display */
  description?: string;
  /** JSON Schema describing the provider-specific configuration. Used by UI to render config forms. */
  configSchema?: Record<string, unknown>;
  /** Create a filesystem instance from the stored config */
  createFilesystem(config: TConfig): WorkspaceFilesystem | Promise<WorkspaceFilesystem>;
}

/**
 * A registered sandbox provider that the editor can use to hydrate
 * stored workspace sandbox configs into runtime instances.
 *
 * Built-in providers (e.g., local) are auto-registered. External providers
 * (e.g., E2B) should be passed to `MastraEditorConfig.sandboxes`.
 */
export interface SandboxProvider<TConfig = Record<string, unknown>> {
  /** Unique provider identifier (e.g., 'local', 'e2b') — matches `StorageSandboxConfig.provider` */
  id: string;
  /** Human-readable name for UI display */
  name: string;
  /** Short description for UI display */
  description?: string;
  /** JSON Schema describing the provider-specific configuration. Used by UI to render config forms. */
  configSchema?: Record<string, unknown>;
  /** Create a sandbox instance from the stored config */
  createSandbox(config: TConfig): WorkspaceSandbox | Promise<WorkspaceSandbox>;
}

/**
 * A registered blob store provider that the editor can use to store/retrieve
 * content-addressable skill blobs.
 *
 * The built-in 'storage' provider uses the configured storage backend's blobs
 * domain. External providers (e.g., S3) can be supplied via `MastraEditorConfig.blobStores`.
 */
export interface BlobStoreProvider<TConfig = Record<string, unknown>> {
  /** Unique provider identifier (e.g., 'storage', 's3') */
  id: string;
  /** Human-readable name for UI display */
  name: string;
  /** Short description for UI display */
  description?: string;
  /** JSON Schema describing the provider-specific configuration. Used by UI to render config forms. */
  configSchema?: Record<string, unknown>;
  /** Create a blob store instance from the stored config */
  createBlobStore(config: TConfig): BlobStore | Promise<BlobStore>;
}

export interface MastraEditorConfig {
  logger?: IMastraLogger;
  /** Tool providers for integration tools (e.g., Composio) */
  toolProviders?: Record<string, ToolProvider>;
  /** Processor providers for configurable processors (e.g., moderation, token limiter) */
  processorProviders?: Record<string, ProcessorProvider>;
  /**
   * Additional filesystem providers beyond the built-in ones.
   * Built-in providers (local) are always available.
   * @example { [s3FilesystemProvider.id]: s3FilesystemProvider }
   */
  filesystems?: Record<string, FilesystemProvider>;
  /**
   * Additional sandbox providers beyond the built-in ones.
   * Built-in providers (local) are always available.
   * @example { [e2bSandboxProvider.id]: e2bSandboxProvider }
   */
  sandboxes?: Record<string, SandboxProvider>;
  /**
   * Additional blob store providers beyond the built-in 'storage' provider.
   * The built-in 'storage' provider uses the configured storage backend's blobs domain.
   * External providers (e.g., S3) allow storing blobs outside the main database.
   * @example { [s3BlobStoreProvider.id]: s3BlobStoreProvider }
   */
  blobStores?: Record<string, BlobStoreProvider>;
}

export interface GetByIdOptions {
  /** Retrieve a specific version by ID. */
  versionId?: string;
  /** Retrieve a specific version by number. */
  versionNumber?: number;
  /** Controls which version is resolved when no versionId/versionNumber is given.
   *  - `'draft'` — always resolves the latest version.
   *  - `'published'` (default) — resolves the active version, falling back to latest.
   */
  status?: 'draft' | 'published' | 'archived';
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
// MCP Server Namespace Interface
// ============================================================================

export interface IEditorMCPServerNamespace {
  create(input: StorageCreateMCPServerInput): Promise<MCPServerBase>;
  getById(id: string, options?: GetByIdOptions): Promise<MCPServerBase | null>;
  update(input: StorageUpdateMCPServerInput): Promise<MCPServerBase>;
  delete(id: string): Promise<void>;
  list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput>;
  listResolved(args?: StorageListMCPServersInput): Promise<StorageListMCPServersResolvedOutput>;
  clearCache(id?: string): void;
}

// ============================================================================
// Workspace Namespace Interface
// ============================================================================

export interface IEditorWorkspaceNamespace {
  create(input: StorageCreateWorkspaceInput): Promise<StorageResolvedWorkspaceType>;
  getById(id: string, options?: GetByIdOptions): Promise<StorageResolvedWorkspaceType | null>;
  update(input: StorageUpdateWorkspaceInput): Promise<StorageResolvedWorkspaceType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput>;
  listResolved(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesResolvedOutput>;
  clearCache(id?: string): void;
}

// ============================================================================
// Skill Namespace Interface
// ============================================================================

export interface IEditorSkillNamespace {
  create(input: StorageCreateSkillInput): Promise<StorageResolvedSkillType>;
  getById(id: string, options?: GetByIdOptions): Promise<StorageResolvedSkillType | null>;
  update(input: StorageUpdateSkillInput): Promise<StorageResolvedSkillType>;
  delete(id: string): Promise<void>;
  list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput>;
  listResolved(args?: StorageListSkillsInput): Promise<StorageListSkillsResolvedOutput>;
  clearCache(id?: string): void;
}

// ============================================================================
// Main Editor Interface
// ============================================================================

/**
 * Interface for the Mastra Editor, which handles agent, prompt, scorer,
 * MCP config, workspace, and skill management from stored data.
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

  /** MCP server management namespace */
  readonly mcpServer: IEditorMCPServerNamespace;

  /** Prompt block management namespace */
  readonly prompt: IEditorPromptNamespace;

  /** Scorer definition management namespace */
  readonly scorer: IEditorScorerNamespace;

  /** Workspace management namespace */
  readonly workspace: IEditorWorkspaceNamespace;

  /** Skill management namespace */
  readonly skill: IEditorSkillNamespace;

  /** Registered tool providers */
  getToolProvider(id: string): ToolProvider | undefined;
  /** List all registered tool providers */
  getToolProviders(): Record<string, ToolProvider>;

  /** Get a processor provider by ID */
  getProcessorProvider(id: string): ProcessorProvider | undefined;
  /** List all registered processor providers */
  getProcessorProviders(): Record<string, ProcessorProvider>;
}
