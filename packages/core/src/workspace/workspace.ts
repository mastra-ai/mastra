/**
 * Workspace Class
 *
 * A Workspace combines a Filesystem and a Sandbox to provide agents
 * with a complete environment for storing files and executing code.
 *
 * Users pass provider instances directly to the Workspace constructor.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { LocalFilesystem } from '@mastra/workspace-fs-local';
 * import { AgentFS } from '@mastra/workspace-fs-agentfs';
 * import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';
 *
 * // Simple workspace with local filesystem
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './workspace' }),
 * });
 *
 * // Full workspace with AgentFS and cloud sandbox
 * const fullWorkspace = new Workspace({
 *   filesystem: new AgentFS({ path: './agent.db' }),
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 *
 * await fullWorkspace.init();
 * await fullWorkspace.filesystem?.writeFile('/code/app.py', 'print("Hello!")');
 * const result = await fullWorkspace.sandbox?.executeCommand?.('python3', ['app.py'], { cwd: '/code' });
 * ```
 */

import type { MastraVector } from '../vector';

import { WorkspaceError, SearchNotAvailableError } from './errors';
import type { WorkspaceFilesystem } from './filesystem';
import type { WorkspaceSandbox } from './sandbox';
import { SearchEngine } from './search';
import type { BM25Config, Embedder, SearchOptions, SearchResult, IndexDocument } from './search';
import type { WorkspaceSkills, SkillsResolver } from './skills';
import { WorkspaceSkillsImpl, LocalSkillSource } from './skills';
import type { WorkspaceToolsConfig } from './tools';
import type { WorkspaceStatus } from './types';

// =============================================================================
// Workspace Configuration
// =============================================================================

/**
 * Configuration for creating a Workspace.
 * Users pass provider instances directly.
 */
export interface WorkspaceConfig {
  /** Unique identifier (auto-generated if not provided) */
  id?: string;

  /** Human-readable name */
  name?: string;

  /**
   * Filesystem provider instance.
   * Use LocalFilesystem for a folder on disk, or AgentFS for Turso-backed storage.
   */
  filesystem?: WorkspaceFilesystem;

  /**
   * Sandbox provider instance.
   * Use ComputeSDKSandbox to access E2B, Modal, Docker, etc.
   */
  sandbox?: WorkspaceSandbox;

  // ---------------------------------------------------------------------------
  // Search Configuration
  // ---------------------------------------------------------------------------

  /**
   * Vector store for semantic search.
   * When provided along with embedder, enables vector and hybrid search.
   */
  vectorStore?: MastraVector;

  /**
   * Embedder function for generating vectors.
   * Required when vectorStore is provided.
   */
  embedder?: Embedder;

  /**
   * Enable BM25 keyword search.
   * Pass true for defaults, or a BM25Config object for custom parameters.
   */
  bm25?: boolean | BM25Config;

  /**
   * Paths to auto-index on init().
   * Files in these directories will be indexed for search.
   * @example ['/docs', '/support']
   */
  autoIndexPaths?: string[];

  /**
   * Paths where skills are located.
   * Workspace will discover SKILL.md files in these directories.
   *
   * Can be a static array of paths or a function that returns paths
   * dynamically based on request context (e.g., user tier, tenant).
   *
   * @example Static paths
   * ```typescript
   * skills: ['/skills', '/node_modules/@myorg/skills']
   * ```
   *
   * @example Dynamic paths
   * ```typescript
   * skills: (ctx) => {
   *   const tier = ctx.requestContext?.get('userTier');
   *   return tier === 'premium'
   *     ? ['/skills/basic', '/skills/premium']
   *     : ['/skills/basic'];
   * }
   * ```
   */
  skills?: SkillsResolver;

  // ---------------------------------------------------------------------------
  // Tool Configuration
  // ---------------------------------------------------------------------------

  /**
   * Per-tool configuration for workspace tools.
   * Controls which tools are enabled and their safety settings.
   *
   * This replaces the provider-level `requireApproval` and `requireReadBeforeWrite`
   * settings, allowing more granular control per tool.
   *
   * @example
   * ```typescript
   * tools: {
   *   mastra_workspace_read_file: {
   *     enabled: true,
   *     requireApproval: false,
   *   },
   *   mastra_workspace_write_file: {
   *     enabled: true,
   *     requireApproval: true,
   *     requireReadBeforeWrite: true,
   *   },
   *   mastra_workspace_execute_command: {
   *     enabled: true,
   *     requireApproval: true,
   *   },
   * }
   * ```
   */
  tools?: WorkspaceToolsConfig;

  // ---------------------------------------------------------------------------
  // Lifecycle Options
  // ---------------------------------------------------------------------------

  /** Auto-sync between fs and sandbox (default: false) */
  autoSync?: boolean;

  /** Timeout for individual operations in milliseconds */
  operationTimeout?: number;
}

// Re-export WorkspaceStatus from types
export type { WorkspaceStatus } from './types';

// =============================================================================
// Path Context Types
// =============================================================================

/**
 * Describes the relationship between filesystem and sandbox.
 */
export type PathContextType =
  | 'same-context' // Filesystem and sandbox share the same environment (e.g., LocalFilesystem + LocalSandbox)
  | 'cross-context' // Filesystem and sandbox are in different environments (requires sync)
  | 'sandbox-only' // Only sandbox is configured
  | 'filesystem-only'; // Only filesystem is configured

/**
 * Information about how filesystem and sandbox paths relate.
 * Used by agents to understand how to access workspace files from sandbox code.
 */
export interface PathContext {
  /** The type of context relationship */
  type: PathContextType;

  /** Filesystem details (if available) */
  filesystem?: {
    provider: string;
    /** Absolute base path on disk (for local filesystems) */
    basePath?: string;
  };

  /** Sandbox details (if available) */
  sandbox?: {
    provider: string;
    /** Working directory for command execution */
    workingDirectory?: string;
  };

  /**
   * Whether files need to be synced between filesystem and sandbox.
   * True for cross-context combinations (e.g., AgentFS + LocalSandbox).
   */
  requiresSync: boolean;

  /**
   * Human-readable instructions for how to access filesystem files from sandbox code.
   */
  instructions: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  status: WorkspaceStatus;
  createdAt: Date;
  lastAccessedAt: Date;

  /** Filesystem info (if available) */
  filesystem?: {
    provider: string;
    totalFiles?: number;
    totalSize?: number;
  };

  /** Sandbox info (if available) */
  sandbox?: {
    provider: string;
    status: string;
    resources?: {
      memoryMB?: number;
      memoryUsedMB?: number;
      cpuCores?: number;
      cpuPercent?: number;
      diskMB?: number;
      diskUsedMB?: number;
    };
  };
}

// =============================================================================
// Workspace Class
// =============================================================================

/**
 * Workspace provides agents with filesystem and execution capabilities.
 *
 * At minimum, a workspace has either a filesystem or a sandbox (or both).
 * Users pass instantiated provider objects to the constructor.
 */
export class Workspace {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  lastAccessedAt: Date;

  private _status: WorkspaceStatus = 'pending';
  private readonly _fs?: WorkspaceFilesystem;
  private readonly _sandbox?: WorkspaceSandbox;
  private readonly _config: WorkspaceConfig;
  private readonly _searchEngine?: SearchEngine;
  private _skills?: WorkspaceSkills;

  constructor(config: WorkspaceConfig) {
    this.id = config.id ?? this.generateId();
    this.name = config.name ?? `workspace-${this.id.slice(0, 8)}`;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();

    this._config = config;
    this._fs = config.filesystem;
    this._sandbox = config.sandbox;

    // Validate vector search config - embedder is required with vectorStore
    if (config.vectorStore && !config.embedder) {
      throw new WorkspaceError('vectorStore requires an embedder', 'INVALID_SEARCH_CONFIG');
    }

    // Create search engine if search is configured
    if (config.bm25 || (config.vectorStore && config.embedder)) {
      this._searchEngine = new SearchEngine({
        bm25: config.bm25
          ? {
              bm25: typeof config.bm25 === 'object' ? config.bm25 : undefined,
            }
          : undefined,
        vector:
          config.vectorStore && config.embedder
            ? {
                vectorStore: config.vectorStore,
                embedder: config.embedder,
                indexName: `${this.id}-search`,
              }
            : undefined,
      });
    }

    // Validate at least one provider is given
    // Note: skills alone is also valid - uses LocalSkillSource for read-only skills
    if (!this._fs && !this._sandbox && !this.hasSkillsConfig()) {
      throw new WorkspaceError('Workspace requires at least a filesystem, sandbox, or skills', 'NO_PROVIDERS');
    }
  }

  private generateId(): string {
    return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private hasSkillsConfig(): boolean {
    return (
      this._config.skills !== undefined && (typeof this._config.skills === 'function' || this._config.skills.length > 0)
    );
  }

  get status(): WorkspaceStatus {
    return this._status;
  }

  /**
   * The filesystem provider (if configured).
   */
  get filesystem(): WorkspaceFilesystem | undefined {
    return this._fs;
  }

  /**
   * Alias for filesystem.
   */
  get fs(): WorkspaceFilesystem | undefined {
    return this._fs;
  }

  /**
   * The sandbox provider (if configured).
   */
  get sandbox(): WorkspaceSandbox | undefined {
    return this._sandbox;
  }

  /**
   * Get the per-tool configuration for this workspace.
   * Returns undefined if no tools config was provided.
   */
  getToolsConfig(): WorkspaceToolsConfig | undefined {
    return this._config.tools;
  }

  /**
   * Access skills stored in this workspace.
   * Skills are SKILL.md files discovered from the configured skillPaths.
   *
   * Returns undefined if no skillPaths are configured.
   *
   * When filesystem is available, skills support full CRUD operations.
   * Without filesystem, skills are loaded read-only via LocalSkillSource.
   *
   * @example
   * ```typescript
   * const skills = await workspace.skills?.list();
   * const skill = await workspace.skills?.get('brand-guidelines');
   * const results = await workspace.skills?.search('brand colors');
   *
   * // CRUD operations (only available with filesystem)
   * if (workspace.skills?.isWritable) {
   *   await workspace.skills.create({ ... });
   * }
   * ```
   */
  get skills(): WorkspaceSkills | undefined {
    // Skills require skills config
    if (!this.hasSkillsConfig()) {
      return undefined;
    }

    // Lazy initialization
    if (!this._skills) {
      // Use filesystem if available (full CRUD), otherwise use LocalSkillSource (read-only)
      const source = this._fs ?? new LocalSkillSource();

      this._skills = new WorkspaceSkillsImpl({
        source,
        skills: this._config.skills!,
        searchEngine: this._searchEngine,
        validateOnLoad: true,
      });
    }

    return this._skills;
  }

  // ---------------------------------------------------------------------------
  // Search Capabilities
  // ---------------------------------------------------------------------------

  /**
   * Check if BM25 keyword search is available.
   */
  get canBM25(): boolean {
    return this._searchEngine?.canBM25 ?? false;
  }

  /**
   * Check if vector semantic search is available.
   */
  get canVector(): boolean {
    return this._searchEngine?.canVector ?? false;
  }

  /**
   * Check if hybrid search is available.
   */
  get canHybrid(): boolean {
    return this._searchEngine?.canHybrid ?? false;
  }

  // ---------------------------------------------------------------------------
  // Search Operations
  // ---------------------------------------------------------------------------

  /**
   * Index content for search.
   * The path becomes the document ID in search results.
   *
   * @param path - File path (used as document ID)
   * @param content - Text content to index
   * @param options - Index options (metadata, type hints)
   * @throws {SearchNotAvailableError} if search is not configured
   */
  async index(
    path: string,
    content: string,
    options?: {
      type?: 'text' | 'image' | 'file';
      mimeType?: string;
      metadata?: Record<string, unknown>;
      startLineOffset?: number;
    },
  ): Promise<void> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    this.lastAccessedAt = new Date();

    const doc: IndexDocument = {
      id: path,
      content,
      metadata: {
        type: options?.type,
        mimeType: options?.mimeType,
        ...options?.metadata,
      },
      startLineOffset: options?.startLineOffset,
    };

    await this._searchEngine.index(doc);
  }

  /**
   * Search indexed content.
   *
   * @param query - Search query string
   * @param options - Search options (topK, mode, filters)
   * @returns Array of search results
   * @throws {SearchNotAvailableError} if search is not configured
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    if (!this._searchEngine) {
      throw new SearchNotAvailableError();
    }
    this.lastAccessedAt = new Date();
    return this._searchEngine.search(query, options);
  }

  /**
   * Rebuild the search index from filesystem paths.
   * Used internally for auto-indexing on init.
   */
  private async rebuildSearchIndex(paths: string[]): Promise<void> {
    if (!this._searchEngine || !this._fs || paths.length === 0) {
      return;
    }

    // Clear existing BM25 index
    this._searchEngine.clear();

    // Index all files from specified paths
    for (const basePath of paths) {
      try {
        const files = await this.getAllFiles(basePath);
        for (const filePath of files) {
          try {
            const content = await this._fs.readFile(filePath, { encoding: 'utf-8' });
            await this._searchEngine.index({
              id: filePath,
              content: content as string,
            });
          } catch {
            // Skip files that can't be read as text
          }
        }
      } catch {
        // Skip paths that don't exist
      }
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    if (!this._fs) return [];

    const files: string[] = [];
    const entries = await this._fs.readdir(dir);

    for (const entry of entries) {
      const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
      if (entry.type === 'file') {
        files.push(fullPath);
      } else if (entry.type === 'directory' && !entry.isSymlink) {
        // Skip symlink directories to prevent infinite recursion from cycles
        files.push(...(await this.getAllFiles(fullPath)));
      }
    }

    return files;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the workspace.
   * Starts the sandbox and initializes the filesystem.
   */
  async init(): Promise<void> {
    this._status = 'initializing';

    try {
      if (this._fs?.init) {
        await this._fs.init();
      }

      if (this._sandbox?.start) {
        await this._sandbox.start();
      }

      // Auto-index files if autoIndexPaths is configured
      if (this._searchEngine && this._config.autoIndexPaths && this._config.autoIndexPaths.length > 0) {
        await this.rebuildSearchIndex(this._config.autoIndexPaths ?? []);
      }

      this._status = 'ready';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /**
   * Destroy the workspace and clean up all resources.
   */
  async destroy(): Promise<void> {
    this._status = 'destroying';

    try {
      if (this._sandbox?.destroy) {
        await this._sandbox.destroy();
      }

      if (this._fs?.destroy) {
        await this._fs.destroy();
      }

      this._status = 'destroyed';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  /**
   * Get workspace information.
   * @param options.includeFileCount - Whether to count total files (can be slow for large workspaces)
   */
  async getInfo(options?: { includeFileCount?: boolean }): Promise<WorkspaceInfo> {
    const info: WorkspaceInfo = {
      id: this.id,
      name: this.name,
      status: this._status,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
    };

    if (this._fs) {
      info.filesystem = {
        provider: this._fs.provider,
      };

      if (options?.includeFileCount) {
        try {
          const files = await this.getAllFiles('/');
          info.filesystem.totalFiles = files.length;
        } catch {
          // Ignore errors - filesystem may not support listing
        }
      }
    }

    if (this._sandbox) {
      const sandboxInfo = await this._sandbox.getInfo?.();
      info.sandbox = {
        provider: this._sandbox.provider,
        status: sandboxInfo?.status ?? this._sandbox.status,
        resources: sandboxInfo?.resources,
      };
    }

    return info;
  }

  /**
   * Get information about how filesystem and sandbox paths relate.
   * Useful for understanding how to access workspace files from sandbox code.
   *
   * @returns PathContext with type, paths, and instructions
   */
  getPathContext(): PathContext {
    const hasFs = !!this._fs;
    const hasSandbox = !!this._sandbox;

    // Filesystem only
    if (hasFs && !hasSandbox) {
      return {
        type: 'filesystem-only',
        filesystem: {
          provider: this._fs!.provider,
          basePath: this._fs!.basePath,
        },
        requiresSync: false,
        instructions: 'No sandbox configured. Files can only be accessed via workspace filesystem tools.',
      };
    }

    // Sandbox only
    if (!hasFs && hasSandbox) {
      return {
        type: 'sandbox-only',
        sandbox: {
          provider: this._sandbox!.provider,
          workingDirectory: this._sandbox!.workingDirectory,
        },
        requiresSync: false,
        instructions: 'No filesystem configured. Command execution is available but files are ephemeral.',
      };
    }

    // Both configured - determine context type
    const fsProvider = this._fs!.provider;
    const sandboxProvider = this._sandbox!.provider;

    // Same-context combinations
    const isSameContext =
      (fsProvider === 'local' && sandboxProvider === 'local') || (fsProvider === 'e2b' && sandboxProvider === 'e2b');

    if (isSameContext) {
      const basePath = this._fs!.basePath;
      const workingDirectory = this._sandbox!.workingDirectory;

      let instructions: string;
      if (basePath) {
        instructions = `Filesystem and sandbox share the same environment. Files written to workspace path "/foo" are accessible at "${basePath}/foo" in executed commands. Working directory for commands: ${workingDirectory ?? 'process.cwd()'}.`;
      } else {
        instructions =
          'Filesystem and sandbox share the same environment. Use workspace_read_file to get file contents.';
      }

      return {
        type: 'same-context',
        filesystem: {
          provider: fsProvider,
          basePath,
        },
        sandbox: {
          provider: sandboxProvider,
          workingDirectory,
        },
        requiresSync: false,
        instructions,
      };
    }

    // Cross-context - requires sync
    return {
      type: 'cross-context',
      filesystem: {
        provider: fsProvider,
        basePath: this._fs!.basePath,
      },
      sandbox: {
        provider: sandboxProvider,
        workingDirectory: this._sandbox!.workingDirectory,
      },
      requiresSync: true,
      instructions:
        'Filesystem and sandbox are in different environments. To use workspace files in commands: 1) Read file contents using workspace_read_file, 2) Pass contents to commands as needed.',
    };
  }
}
