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

import type { IMastraLogger } from '../logger';
import type { MastraVector } from '../vector';

import { WORKSPACE_TOOLS } from './constants';
import type { WorkspaceToolName } from './constants';
import { WorkspaceError, SearchNotAvailableError } from './errors';
import { CompositeFilesystem } from './filesystem';
import type { WorkspaceFilesystem, FilesystemInfo } from './filesystem';
import { MastraFilesystem } from './filesystem/mastra-filesystem';
import { isGlobPattern, extractGlobBase, createGlobMatcher } from './glob';
import { callLifecycle } from './lifecycle';
import type { WorkspaceSandbox, OnMountHook } from './sandbox';
import { MastraSandbox } from './sandbox/mastra-sandbox';
import { SearchEngine } from './search';
import type { BM25Config, Embedder, SearchOptions, SearchResult, IndexDocument } from './search';
import type { WorkspaceSkills, SkillsResolver, SkillSource } from './skills';
import { WorkspaceSkillsImpl, LocalSkillSource } from './skills';
import type { WorkspaceToolsConfig } from './tools';
import { resolveToolConfig } from './tools/tools';
import type { WorkspaceStatus } from './types';

// =============================================================================
// Workspace Configuration
// =============================================================================

/**
 * Configuration for creating a Workspace.
 * Users pass provider instances directly.
 *
 * Generic type parameters allow the workspace to preserve the concrete types
 * of filesystem and sandbox providers, so accessors return the exact type
 * you passed in.
 */
export interface WorkspaceConfig<
  TFilesystem extends WorkspaceFilesystem | undefined = WorkspaceFilesystem | undefined,
  TSandbox extends WorkspaceSandbox | undefined = WorkspaceSandbox | undefined,
  TMounts extends Record<string, WorkspaceFilesystem> | undefined = undefined,
> {
  /** Unique identifier (auto-generated if not provided) */
  id?: string;

  /** Human-readable name */
  name?: string;

  /**
   * Filesystem provider instance.
   * Use LocalFilesystem for a folder on disk, or AgentFS for Turso-backed storage.
   * Extend MastraFilesystem for automatic logger integration.
   */
  filesystem?: TFilesystem;

  /**
   * Sandbox provider instance.
   * Use ComputeSDKSandbox to access E2B, Modal, Docker, etc.
   * Extend MastraSandbox for automatic logger integration.
   */
  sandbox?: TSandbox;

  /**
   * Mount multiple filesystems at different paths.
   * Creates a CompositeFilesystem that routes operations based on path.
   *
   * When a sandbox is configured, filesystems are automatically mounted
   * into the sandbox at their respective paths during init().
   *
   * Use the `onMount` hook to skip or customize mounting for specific filesystems.
   *
   * The concrete mount types are preserved — use `workspace.filesystem.mounts.get()`
   * for typed access to individual mounts.
   *
   * @example
   * ```typescript
   * const workspace = new Workspace({
   *   sandbox: new E2BSandbox({ timeout: 60000 }),
   *   mounts: {
   *     '/data': new S3Filesystem({ bucket: 'my-data', ... }),
   *     '/skills': new S3Filesystem({ bucket: 'skills', readOnly: true, ... }),
   *   },
   * });
   *
   * await workspace.init();
   * workspace.filesystem                    // CompositeFilesystem<{ '/data': S3Filesystem, '/skills': S3Filesystem }>
   * workspace.filesystem.mounts.get('/data') // S3Filesystem
   * ```
   */
  mounts?: TMounts;

  /**
   * Hook called before mounting each filesystem into the sandbox.
   *
   * Return values:
   * - `false` - Skip mount entirely (don't mount this filesystem)
   * - `{ success: true }` - Hook handled the mount successfully
   * - `{ success: false, error?: string }` - Hook attempted mount but failed
   * - `undefined` / no return - Use provider's default mount behavior
   *
   * This is useful for:
   * - Skipping specific filesystems (e.g., local filesystems in remote sandbox)
   * - Custom mount implementations
   * - Syncing files instead of FUSE mounting
   *
   * Note: If your hook handles the mount, you're responsible for the entire
   * implementation. The sandbox provider won't do any additional tracking.
   *
   * @example Skip local filesystems
   * ```typescript
   * const workspace = new Workspace({
   *   sandbox: new E2BSandbox(),
   *   mounts: {
   *     '/data': new S3Filesystem({ bucket: 'data', ... }),
   *     '/local': new LocalFilesystem({ basePath: './data' }),
   *   },
   *   onMount: ({ filesystem }) => {
   *     if (filesystem.provider === 'local') return false;
   *   },
   * });
   * ```
   *
   * @example Custom mount implementation
   * ```typescript
   * onMount: async ({ filesystem, mountPath, config, sandbox }) => {
   *   if (config?.type === 's3') {
   *     await sandbox.executeCommand?.('my-s3-mount', [mountPath]);
   *     return { success: true };
   *   }
   * }
   * ```
   */
  onMount?: OnMountHook;

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
   * Custom index name for the vector store.
   * If not provided, defaults to a sanitized version of `${id}_search`.
   *
   * Must be a valid SQL identifier for SQL-based stores (PgVector, LibSQL):
   * - Start with a letter or underscore
   * - Contain only letters, numbers, or underscores
   * - Maximum 63 characters
   *
   * @example 'my_workspace_vectors'
   */
  searchIndexName?: string;

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

  /**
   * Custom SkillSource to use for skill discovery.
   * When provided, this source is used instead of the workspace filesystem or LocalSkillSource.
   *
   * Use `VersionedSkillSource` to read skills from the content-addressable blob store,
   * serving a specific published version without touching the live filesystem.
   *
   * @example
   * ```typescript
   * import { VersionedSkillSource } from '@mastra/core/workspace';
   *
   * const workspace = new Workspace({
   *   skills: ['/skills'],
   *   skillSource: new VersionedSkillSource(tree, blobStore, versionCreatedAt),
   * });
   * ```
   */
  skillSource?: SkillSource;

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

  /**
   * Custom tool usage guidelines for agents.
   *
   * Can be:
   * - A string to completely replace the default guidelines
   * - A function that receives the generated guidelines and can modify/extend them
   *
   * @example Override completely
   * ```typescript
   * toolGuidelines: 'Only use workspace tools when absolutely necessary.'
   * ```
   *
   * @example Extend default guidelines
   * ```typescript
   * toolGuidelines: (defaultGuidelines) => {
   *   return defaultGuidelines + '\n\n### Custom Rules\n- Always backup before editing';
   * }
   * ```
   *
   * @example Filter/modify guidelines
   * ```typescript
   * toolGuidelines: (defaultGuidelines) => {
   *   // Remove command execution guidelines
   *   return defaultGuidelines.replace(/### Command Execution[\s\S]*?(?=###|$)/g, '');
   * }
   * ```
   */
  toolGuidelines?: string | ((defaultGuidelines: string) => string);

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

/**
 * A Workspace with any combination of filesystem, sandbox, and mounts.
 * Use this when you need to accept any Workspace regardless of its generic parameters.
 */
export type AnyWorkspace = Workspace<WorkspaceFilesystem | undefined, WorkspaceSandbox | undefined, any>;

// =============================================================================
// Path Context Types
// =============================================================================

/**
 * Information about how filesystem and sandbox paths relate.
 * Used by agents to understand how to access workspace files from sandbox code.
 */
export interface PathContext {
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
   * Human-readable instructions for how to access filesystem files from sandbox code.
   * Combined from filesystem and sandbox provider instructions.
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
  filesystem?: FilesystemInfo & {
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
export class Workspace<
  TFilesystem extends WorkspaceFilesystem | undefined = WorkspaceFilesystem | undefined,
  TSandbox extends WorkspaceSandbox | undefined = WorkspaceSandbox | undefined,
  TMounts extends Record<string, WorkspaceFilesystem> | undefined = undefined,
> {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  lastAccessedAt: Date;

  private _status: WorkspaceStatus = 'pending';
  private readonly _fs?: WorkspaceFilesystem;
  private readonly _sandbox?: WorkspaceSandbox;
  private readonly _config: WorkspaceConfig<TFilesystem, TSandbox, TMounts>;
  private readonly _searchEngine?: SearchEngine;
  private _skills?: WorkspaceSkills;

  constructor(config: WorkspaceConfig<TFilesystem, TSandbox, TMounts>) {
    this.id = config.id ?? this.generateId();
    this.name = config.name ?? `workspace-${this.id.slice(0, 8)}`;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();

    this._config = config;
    this._sandbox = config.sandbox;

    // Setup mounts - creates CompositeFilesystem and informs sandbox
    if (config.mounts && Object.keys(config.mounts).length > 0) {
      // Validate: can't use both filesystem and mounts
      if (config.filesystem) {
        throw new WorkspaceError('Cannot use both "filesystem" and "mounts"', 'INVALID_CONFIG');
      }

      this._fs = new CompositeFilesystem({ mounts: config.mounts });
      if (this._sandbox?.mounts) {
        // Inform sandbox about mounts so it can process them on start()
        this._sandbox.mounts.setContext({ sandbox: this._sandbox, workspace: this as unknown as Workspace });
        this._sandbox.mounts.add(config.mounts);
        if (config.onMount) {
          this._sandbox.mounts.setOnMount(config.onMount);
        }
      }
    } else {
      this._fs = config.filesystem;
    }

    // Validate vector search config - embedder is required with vectorStore
    if (config.vectorStore && !config.embedder) {
      throw new WorkspaceError('vectorStore requires an embedder', 'INVALID_SEARCH_CONFIG');
    }

    // Create search engine if search is configured
    if (config.bm25 || (config.vectorStore && config.embedder)) {
      const buildIndexName = (): string => {
        // Sanitize default name: replace all non-alphanumeric chars with underscores
        const defaultName = `${this.id}_search`.replace(/[^a-zA-Z0-9_]/g, '_');
        const indexName = config.searchIndexName ?? defaultName;

        // Validate SQL identifier format
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(indexName)) {
          throw new WorkspaceError(
            `Invalid searchIndexName: "${indexName}". Must start with a letter or underscore, and contain only letters, numbers, or underscores.`,
            'INVALID_SEARCH_CONFIG',
            this.id,
          );
        }
        if (indexName.length > 63) {
          throw new WorkspaceError(
            `searchIndexName exceeds 63 characters (got ${indexName.length})`,
            'INVALID_SEARCH_CONFIG',
            this.id,
          );
        }
        return indexName;
      };

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
                indexName: buildIndexName(),
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
   *
   * Returns the concrete type you passed to the constructor.
   * When `mounts` is used instead of `filesystem`, returns `CompositeFilesystem`
   * parameterized with the concrete mount types.
   */
  get filesystem(): [TMounts] extends [Record<string, WorkspaceFilesystem>]
    ? CompositeFilesystem<TMounts>
    : TFilesystem {
    return this._fs as any;
  }

  /**
   * The sandbox provider (if configured).
   *
   * Returns the concrete type you passed to the constructor.
   */
  get sandbox(): TSandbox {
    return this._sandbox as any;
  }

  /**
   * Get the per-tool configuration for this workspace.
   * Returns undefined if no tools config was provided.
   */
  getToolsConfig(): WorkspaceToolsConfig | undefined {
    return this._config.tools;
  }

  /**
   * Get the tool guidelines configuration for this workspace.
   * Can be a string to override defaults, or a function to customize them.
   */
  getToolGuidelinesConfig(): string | ((defaultGuidelines: string) => string) | undefined {
    return this._config.toolGuidelines;
  }

  /**
   * Access skills stored in this workspace.
   * Skills are SKILL.md files discovered from the configured skillPaths.
   *
   * Returns undefined if no skillPaths are configured.
   *
   * @example
   * ```typescript
   * const skills = await workspace.skills?.list();
   * const skill = await workspace.skills?.get('brand-guidelines');
   * const results = await workspace.skills?.search('brand colors');
   * ```
   */
  get skills(): WorkspaceSkills | undefined {
    // Skills require skills config
    if (!this.hasSkillsConfig()) {
      return undefined;
    }

    // Lazy initialization
    if (!this._skills) {
      // Priority: explicit skillSource > workspace filesystem > LocalSkillSource (read-only from local disk)
      const source = this._config.skillSource ?? this._fs ?? new LocalSkillSource();

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
   *
   * Paths can be plain directories (e.g., '/docs') or glob patterns
   * (e.g., '/docs/**\/*.md'). Glob patterns are resolved to a walk root
   * via extractGlobBase, then files are filtered by the pattern.
   */
  private async rebuildSearchIndex(paths: string[]): Promise<void> {
    if (!this._searchEngine || !this._fs || paths.length === 0) {
      return;
    }

    // Clear existing BM25 index
    this._searchEngine.clear();

    // Index all files from specified paths
    for (const pathOrGlob of paths) {
      try {
        if (isGlobPattern(pathOrGlob)) {
          // Glob pattern: walk from the base directory, filter with matcher
          const walkRoot = extractGlobBase(pathOrGlob);
          const matcher = createGlobMatcher(pathOrGlob);
          const files = await this.getAllFiles(walkRoot);
          for (const filePath of files) {
            if (!matcher(filePath)) continue;
            await this.indexFileForSearch(filePath);
          }
        } else {
          // Plain path: recurse everything (existing behavior)
          const files = await this.getAllFiles(pathOrGlob);
          for (const filePath of files) {
            await this.indexFileForSearch(filePath);
          }
        }
      } catch {
        // Skip paths that don't exist
      }
    }
  }

  /**
   * Index a single file for search. Skips files that can't be read as text.
   */
  private async indexFileForSearch(filePath: string): Promise<void> {
    try {
      const content = await this._fs!.readFile(filePath, { encoding: 'utf-8' });
      await this._searchEngine!.index({
        id: filePath,
        content: content as string,
      });
    } catch {
      // Skip files that can't be read as text
    }
  }

  private async getAllFiles(dir: string, depth: number = 0, maxDepth: number = 10): Promise<string[]> {
    if (!this._fs || depth >= maxDepth) return [];

    const files: string[] = [];
    const entries = await this._fs.readdir(dir);

    for (const entry of entries) {
      const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;
      if (entry.type === 'file') {
        files.push(fullPath);
      } else if (entry.type === 'directory' && !entry.isSymlink) {
        // Skip symlink directories to prevent infinite recursion from cycles
        files.push(...(await this.getAllFiles(fullPath, depth + 1, maxDepth)));
      }
    }

    return files;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the workspace.
   * Starts the sandbox, initializes the filesystem, and auto-mounts filesystems.
   */
  async init(): Promise<void> {
    this._status = 'initializing';

    try {
      if (this._fs) {
        await callLifecycle(this._fs, 'init');
      }

      if (this._sandbox) {
        await callLifecycle(this._sandbox, 'start');
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
      if (this._sandbox) {
        await callLifecycle(this._sandbox, 'destroy');
      }

      if (this._fs) {
        await callLifecycle(this._fs, 'destroy');
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
      const fsInfo = await this._fs.getInfo?.();
      info.filesystem = {
        id: fsInfo?.id ?? this._fs.id,
        name: fsInfo?.name ?? this._fs.name,
        provider: fsInfo?.provider ?? this._fs.provider,
        readOnly: fsInfo?.readOnly ?? this._fs.readOnly,
        status: fsInfo?.status,
        error: fsInfo?.error,
        icon: fsInfo?.icon,
        metadata: fsInfo?.metadata,
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
   * @returns PathContext with paths and instructions from providers
   */
  getPathContext(): PathContext {
    // Get instructions from providers
    const fsInstructions = this._fs?.getInstructions?.();
    const sandboxInstructions = this._sandbox?.getInstructions?.();

    // Combine instructions from both providers
    const instructions = [fsInstructions, sandboxInstructions].filter(Boolean).join(' ');

    return {
      filesystem: this._fs
        ? {
            provider: this._fs.provider,
            basePath: this._fs.basePath,
          }
        : undefined,
      sandbox: this._sandbox
        ? {
            provider: this._sandbox.provider,
            workingDirectory: this._sandbox.workingDirectory,
          }
        : undefined,
      instructions,
    };
  }

  // ---------------------------------------------------------------------------
  // Agent Instructions
  // ---------------------------------------------------------------------------

  /**
   * Build comprehensive instructions for agents using this workspace.
   *
   * Returns empty string if:
   * - No workspace tools are enabled (skills-only workspace)
   * - All tools have been disabled via config
   *
   * Structure (when tools are available):
   * 1. Base behavior guidelines (conditional based on what's enabled)
   * 2. Workspace context (provider-specific)
   * 3. Tool-specific guidelines (dynamic based on enabled tools)
   *
   * @returns Formatted instructions string for agent system prompt
   */
  getAgentInstructions(): string {
    // Check if any workspace tools are actually enabled
    const enabledTools = this.getEnabledTools();
    if (enabledTools.length === 0) {
      // Skills-only workspace or all tools disabled
      return '';
    }

    const sections: string[] = [];

    // Section 1: Base Behavior Guidelines (conditional)
    const baseBehavior = this.buildBaseBehaviorSection(enabledTools);
    if (baseBehavior) sections.push(baseBehavior);

    // Section 2: Workspace Context
    const context = this.buildContextSection();
    if (context) sections.push(context);

    // Section 3: Tool-Specific Guidelines
    const toolGuidelines = this.buildToolGuidelinesSection(enabledTools);
    if (toolGuidelines) sections.push(toolGuidelines);

    // Apply user customization
    const combined = sections.filter(Boolean).join('\n\n');
    return this.applyUserCustomization(combined);
  }

  /**
   * Get list of workspace tools that are actually enabled.
   * Considers: provider availability, readOnly mode, and tools config.
   */
  getEnabledTools(): WorkspaceToolName[] {
    const tools: WorkspaceToolName[] = [];
    const config = this._config.tools;
    const isReadOnly = this._fs?.readOnly ?? false;

    // Filesystem tools
    if (this._fs) {
      if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.READ_FILE)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      }
      if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
      }
      if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
      }

      if (!isReadOnly) {
        if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
        }
        if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
        }
        if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.DELETE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
        }
        if (this.isToolEnabled(config, WORKSPACE_TOOLS.FILESYSTEM.MKDIR)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
        }
      }
    }

    // Search tools
    if (this.canBM25 || this.canVector) {
      if (this.isToolEnabled(config, WORKSPACE_TOOLS.SEARCH.SEARCH)) {
        tools.push(WORKSPACE_TOOLS.SEARCH.SEARCH);
      }
      if (!isReadOnly && this.isToolEnabled(config, WORKSPACE_TOOLS.SEARCH.INDEX)) {
        tools.push(WORKSPACE_TOOLS.SEARCH.INDEX);
      }
    }

    // Sandbox tools
    if (this._sandbox?.executeCommand) {
      if (this.isToolEnabled(config, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND)) {
        tools.push(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      }
    }

    return tools;
  }

  /**
   * Check if a specific tool is enabled in the config.
   * Default is enabled unless explicitly disabled.
   */
  private isToolEnabled(config: WorkspaceToolsConfig | undefined, toolName: WorkspaceToolName): boolean {
    const resolved = resolveToolConfig(config, toolName);
    return resolved.enabled;
  }

  /**
   * Build the base behavior guidelines section.
   * Conditional based on which tools are enabled.
   */
  private buildBaseBehaviorSection(enabledTools: WorkspaceToolName[]): string {
    const guidelines: string[] = ['## General Tool Behavior', ''];

    // Always included (if we have any tools)
    guidelines.push('- Call multiple independent workspace operations in parallel when possible');
    guidelines.push('- Never use placeholder values for tool arguments');

    // Check for filesystem tools
    const hasListFiles = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    const hasReadFile = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    const hasEditFile = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
    const hasWriteFile = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    const hasAnyFsTools = hasListFiles || hasReadFile || hasEditFile || hasWriteFile;

    // Check for sandbox
    const hasExecuteCommand = enabledTools.includes(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);

    if (hasAnyFsTools) {
      guidelines.push('- Filesystem tools use workspace paths (e.g., "/src/index.ts") not absolute system paths');

      if (hasListFiles) {
        guidelines.push('- Use list_files to discover file paths rather than guessing');
      }

      if (hasReadFile && (hasEditFile || hasWriteFile)) {
        guidelines.push('- Read files before editing them to understand current content');
      }

      // Read-only workspace (has read tools but no write tools)
      if (hasReadFile && !hasEditFile && !hasWriteFile) {
        guidelines.push('- This workspace is read-only - write operations are not available');
      }

      // Both FS tools and sandbox
      if (hasExecuteCommand) {
        guidelines.push('- Prefer workspace file tools over shell commands (e.g., read_file over cat)');
      }
    }

    // Sandbox-specific guidance
    if (hasExecuteCommand) {
      // Sandbox-only (no FS tools)
      if (!hasAnyFsTools) {
        guidelines.push('- File operations are only available via sandbox commands');
      }
      // Sandbox paths are relative to working directory or absolute within sandbox
      guidelines.push('- Sandbox commands use paths relative to the sandbox working directory');
      // Safety for destructive operations
      guidelines.push(
        '- Be cautious with destructive commands (rm -rf, git push --force, git reset --hard) - only run if explicitly requested',
      );
      // Git-specific safety
      guidelines.push(
        '- For git: prefer staging specific files over "git add -A", and only commit when explicitly asked',
      );
    }

    return guidelines.join('\n');
  }

  /**
   * Build the workspace context section.
   * Includes provider-specific instructions.
   */
  private buildContextSection(): string {
    const lines: string[] = [];

    // Get instructions from providers
    const fsInstructions = this._fs?.getInstructions?.();
    const sandboxInstructions = this._sandbox?.getInstructions?.();

    if (fsInstructions || sandboxInstructions) {
      lines.push('## Workspace Context');
      lines.push('');

      if (fsInstructions) {
        const readOnlySuffix = this._fs?.readOnly ? ' (read-only)' : '';
        lines.push(`Filesystem: ${fsInstructions}${readOnlySuffix}`);
      }

      if (sandboxInstructions) {
        lines.push(`Sandbox: ${sandboxInstructions}`);
      }

      // Add path relationship hint if both are available
      if (this._fs && this._sandbox) {
        const fsBasePath = this._fs.basePath;
        const sandboxWorkingDir = this._sandbox.workingDirectory;

        if (fsBasePath && sandboxWorkingDir && fsBasePath === sandboxWorkingDir) {
          lines.push('');
          lines.push(
            'The sandbox working directory matches the filesystem root, so paths are consistent between workspace tools and sandbox commands.',
          );
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Build cross-tool workflow guidelines.
   * Focus on tool selection and multi-tool patterns, not tool-specific mechanics.
   * Tool-specific details belong in tool descriptions.
   */
  private buildToolGuidelinesSection(enabledTools: WorkspaceToolName[]): string {
    const lines: string[] = [];

    const hasReadFile = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    const hasWriteFile = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    const hasEditFile = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
    const hasListFiles = enabledTools.includes(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    const hasSearch = enabledTools.includes(WORKSPACE_TOOLS.SEARCH.SEARCH);
    const hasExecuteCommand = enabledTools.includes(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);

    const guidelines: string[] = [];

    // Cross-tool preferences
    if (hasEditFile && hasWriteFile) {
      guidelines.push(
        `- Prefer ${WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE} over ${WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE} for modifying existing files`,
      );
    }

    // Search workflow - important context for decision-making
    if (hasSearch) {
      guidelines.push(`- ${WORKSPACE_TOOLS.SEARCH.SEARCH} only searches indexed content, not all files`);
      if (hasReadFile) {
        guidelines.push(
          `- Use search results to find relevant files, then ${WORKSPACE_TOOLS.FILESYSTEM.READ_FILE} to examine them`,
        );
      }
    }

    // Prefer workspace tools over shell commands
    if (hasExecuteCommand && (hasListFiles || hasReadFile)) {
      if (hasListFiles) {
        guidelines.push(`- Use ${WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES} instead of shell "ls" command`);
      }
      if (hasReadFile) {
        guidelines.push(`- Use ${WORKSPACE_TOOLS.FILESYSTEM.READ_FILE} instead of shell "cat" command`);
      }
    }

    if (guidelines.length > 0) {
      lines.push('## Cross-Tool Workflow');
      lines.push('');
      lines.push(...guidelines);
    }

    return lines.join('\n');
  }

  /**
   * Apply user customization from toolGuidelines config.
   */
  private applyUserCustomization(instructions: string): string {
    const config = this._config.toolGuidelines;

    if (typeof config === 'string') {
      // Complete override
      return config;
    }

    if (typeof config === 'function') {
      // User customization function
      return config(instructions);
    }

    // No customization
    return instructions;
  }

  // ---------------------------------------------------------------------------
  // Logger Integration
  // ---------------------------------------------------------------------------

  /**
   * Set the logger for this workspace and propagate to providers.
   * Called by Mastra when the logger is set.
   * @internal
   */
  __setLogger(logger: IMastraLogger): void {
    // Propagate logger to filesystem provider if it extends MastraFilesystem
    if (this._fs instanceof MastraFilesystem) {
      this._fs.__setLogger(logger);
    }

    // Propagate logger to sandbox provider if it extends MastraSandbox
    if (this._sandbox instanceof MastraSandbox) {
      this._sandbox.__setLogger(logger);
    }
  }
}
