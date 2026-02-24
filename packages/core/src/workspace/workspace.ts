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
import type { RequestContext } from '../request-context';
import type { MastraVector } from '../vector';

import { WorkspaceError, SearchNotAvailableError } from './errors';
import { CompositeFilesystem } from './filesystem';
import type { WorkspaceFilesystem, FilesystemInfo } from './filesystem';
import { MastraFilesystem } from './filesystem/mastra-filesystem';
import { isGlobPattern, extractGlobBase, createGlobMatcher } from './glob';
import { callLifecycle } from './lifecycle';
import { findProjectRoot, isLSPAvailable, LSPManager } from './lsp';
import type { LSPConfig } from './lsp/types';
import type { WorkspaceSandbox, OnMountHook } from './sandbox';
import { MastraSandbox } from './sandbox/mastra-sandbox';
import { SearchEngine } from './search';
import type { BM25Config, Embedder, SearchOptions, SearchResult, IndexDocument } from './search';
import type { WorkspaceSkills, SkillsResolver, SkillSource } from './skills';
import { WorkspaceSkillsImpl, LocalSkillSource } from './skills';
import type { WorkspaceToolsConfig } from './tools';
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
  // LSP Configuration
  // ---------------------------------------------------------------------------

  /**
   * Enable LSP diagnostics for edit tools.
   *
   * When enabled, edit tools (edit_file, write_file, ast_edit) will append
   * type errors, warnings, and other diagnostics from language servers after edits.
   *
   * LSP requires a sandbox with a process manager (`sandbox.processes`) to spawn
   * language server processes. It works with any sandbox backend (local, E2B, etc.).
   *
   * Requires optional peer dependencies: `vscode-jsonrpc`, `vscode-languageserver-protocol`,
   * and the relevant language server (e.g. `typescript-language-server` for TypeScript).
   *
   * - `true` — Enable with defaults
   * - `LSPConfig` object — Enable with custom timeouts/settings
   *
   * @default undefined (disabled)
   */
  lsp?: boolean | LSPConfig;

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
  private _lsp?: LSPManager;

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

    // Initialize LSP if configured and a process manager is available
    if (config.lsp) {
      const processes = this._sandbox?.processes;
      if (!this._sandbox) {
        console.warn(
          `[Workspace "${this.name}"] lsp: true requires a sandbox with a process manager. No sandbox configured — LSP disabled.`,
        );
      } else if (!processes) {
        console.warn(
          `[Workspace "${this.name}"] lsp: true requires a sandbox with a process manager. Sandbox "${this._sandbox.name ?? 'unknown'}" does not provide one — LSP disabled.`,
        );
      } else if (!isLSPAvailable()) {
        console.warn(
          `[Workspace "${this.name}"] lsp: true requires vscode-jsonrpc and vscode-languageserver-protocol packages. Install them to enable LSP diagnostics.`,
        );
      } else {
        const lspConfig = config.lsp === true ? {} : config.lsp;
        const defaultRoot = lspConfig.root ?? findProjectRoot(process.cwd()) ?? process.cwd();
        this._lsp = new LSPManager(processes, defaultRoot, lspConfig, this._fs);
      }
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
   * The LSP manager (if configured, initialized, and a process manager is available).
   * Returns undefined if LSP is not configured, deps are missing, or sandbox has no process manager.
   */
  get lsp(): LSPManager | undefined {
    return this._lsp;
  }

  /**
   * Update the per-tool configuration for this workspace.
   * Takes effect on the next `createWorkspaceTools()` call.
   *
   * @example
   * ```typescript
   * // Disable write tools for read-only mode
   * workspace.setToolsConfig({
   *   mastra_workspace_write_file: { enabled: false },
   *   mastra_workspace_edit_file: { enabled: false },
   * });
   *
   * // Re-enable all tools
   * workspace.setToolsConfig(undefined);
   * ```
   */
  setToolsConfig(config: WorkspaceToolsConfig | undefined): void {
    this._config.tools = config;
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
      // Shutdown LSP before sandbox — LSP clients need running processes to send shutdown/exit
      if (this._lsp) {
        try {
          await this._lsp.shutdownAll();
        } catch {
          // LSP shutdown errors are non-blocking
        }
        this._lsp = undefined;
      }

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
   * Get human-readable instructions describing the workspace environment.
   *
   * When both a sandbox with mounts and a filesystem exist, each mount path
   * is classified as sandbox-accessible (state === 'mounted') or
   * workspace-only (pending / mounting / error / unsupported). When there's
   * no sandbox or no mounts, falls back to provider-level instructions.
   *
   * @param opts - Optional options including request context for per-request customisation
   * @returns Combined instructions string (may be empty)
   */
  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const parts: string[] = [];

    // Sandbox-level instructions (working directory, provider type)
    const sandboxInstructions = this._sandbox?.getInstructions?.(opts);
    if (sandboxInstructions) parts.push(sandboxInstructions);

    // Mount state overlay: check actual MountManager state
    const mountEntries = this._sandbox?.mounts?.entries;
    if (mountEntries && mountEntries.size > 0) {
      const sandboxAccessible: string[] = [];
      const workspaceOnly: string[] = [];

      for (const [mountPath, entry] of mountEntries) {
        const fsName = entry.filesystem.displayName || entry.filesystem.provider;
        const access = entry.filesystem.readOnly ? 'read-only' : 'read-write';

        if (entry.state === 'mounted') {
          sandboxAccessible.push(`  - ${mountPath}: ${fsName} (${access})`);
        } else {
          // pending, mounting, error, unsupported — NOT accessible in sandbox
          workspaceOnly.push(`  - ${mountPath}: ${fsName} (${access})`);
        }
      }

      if (sandboxAccessible.length) {
        parts.push(`Sandbox-mounted filesystems (accessible in shell commands):\n${sandboxAccessible.join('\n')}`);
      }
      if (workspaceOnly.length) {
        parts.push(
          `Workspace-only filesystems (use file tools, NOT available in shell commands):\n${workspaceOnly.join('\n')}`,
        );
      }
    } else {
      // No mounts or no sandbox — fall back to filesystem-level instructions
      const fsInstructions = this._fs?.getInstructions?.(opts);
      if (fsInstructions) parts.push(fsInstructions);
    }

    return parts.join('\n\n');
  }

  /**
   * Get information about how filesystem and sandbox paths relate.
   * Useful for understanding how to access workspace files from sandbox code.
   *
   * @deprecated Use {@link getInstructions} instead. `getInstructions()` is
   * mount-state-aware and feeds into the system message via
   * `WorkspaceInstructionsProcessor`.
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
