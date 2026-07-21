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

import * as path from 'node:path';
import pMap, { pMapSkip } from 'p-map';
import type { MastraBrowser } from '../browser';
import type { IMastraLogger } from '../logger';
import { RequestContext } from '../request-context';
import type { MastraVector } from '../vector';

import { WorkspaceError, SearchNotAvailableError } from './errors';
import { CompositeFilesystem, LocalFilesystem } from './filesystem';
import type { WorkspaceFilesystem, FilesystemInfo } from './filesystem';
import { MastraFilesystem } from './filesystem/mastra-filesystem';
import { resolvePathPattern } from './glob';
import type { ReaddirEntry } from './glob';
import { callLifecycle } from './lifecycle';
import { findProjectRoot, isLSPAvailable, LSPManager } from './lsp';
import type { LSPConfig } from './lsp/types';
import type { WorkspaceSandbox, OnMountHook } from './sandbox';
import { LocalSandbox } from './sandbox/local-sandbox';
import { MastraSandbox } from './sandbox/mastra-sandbox';
import type {
  BM25Config,
  BM25SearchConfig,
  TokenizeOptions,
  Embedder,
  SearchOptions,
  SearchResult,
  IndexDocument,
} from './search';
import { SearchEngine, splitIntoChunks } from './search';
import type { WorkspaceSkills, SkillsResolver, SkillSource } from './skills';
import { WorkspaceSkillsImpl, LocalSkillSource } from './skills';
import type { WorkspaceToolsConfig } from './tools';
import type { WorkspaceStatus } from './types';

/** Workspace instructions for a resolver-backed sandbox in `'placeholder'` mode. */
const DYNAMIC_SANDBOX_INSTRUCTIONS =
  'Dynamic sandbox configured. Shell commands execute in a request-scoped sandbox resolved at tool execution time.';

// =============================================================================
// Workspace Configuration
// =============================================================================

/**
 * A function that resolves a WorkspaceFilesystem dynamically based on request context.
 * Called on each tool invocation, allowing different filesystems per request.
 */
export type WorkspaceFilesystemResolver = (context: {
  requestContext: RequestContext;
}) => WorkspaceFilesystem | Promise<WorkspaceFilesystem>;

/**
 * A function that resolves a WorkspaceSandbox dynamically based on request context.
 * Called on each tool invocation, allowing different sandboxes per request.
 *
 * The caller owns the returned sandbox's lifecycle.
 */
export type WorkspaceSandboxResolver = (context: {
  requestContext: RequestContext;
}) => WorkspaceSandbox | Promise<WorkspaceSandbox>;

/**
 * How a resolver-backed sandbox contributes to workspace instructions:
 * `'placeholder'` (default) emits stable text without calling the resolver,
 * `'resolve'` uses the resolved sandbox's instructions, a function returns
 * custom text from `requestContext` without resolving.
 */
export type DynamicSandboxInstructions =
  'placeholder' | 'resolve' | ((context: { requestContext: RequestContext }) => string);

/**
 * Produces a stable cache key (e.g. a thread or tenant id) for a resolver-backed
 * sandbox. Resolved sandboxes are memoized per key instead of per RequestContext
 * instance. Return `undefined` to fall back to per-RequestContext memoization.
 */
export type WorkspaceSandboxCacheKey = (context: { requestContext: RequestContext }) => string | undefined;

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
   * Filesystem provider instance, or a resolver function for dynamic per-request filesystems.
   *
   * Static: Pass a LocalFilesystem, AgentFS, or any WorkspaceFilesystem instance.
   * Dynamic: Pass a function `({ requestContext }) => WorkspaceFilesystem` to resolve
   * a different filesystem per request. The resolver is called at tool execution time.
   *
   * Extend MastraFilesystem for automatic logger integration (static instances only).
   */
  filesystem?: TFilesystem | WorkspaceFilesystemResolver;

  /**
   * Sandbox provider instance, or a resolver function for dynamic per-request sandboxes.
   *
   * Static: Pass a LocalSandbox, ComputeSDKSandbox, or any WorkspaceSandbox instance.
   * Dynamic: Pass a function `({ requestContext }) => WorkspaceSandbox` to resolve
   * a different sandbox per request. The resolver is called at tool execution time.
   *
   * When using a resolver, the caller owns the returned sandbox's lifecycle.
   * Mounts and `lsp: true` are incompatible with a resolver.
   *
   * Extend MastraSandbox for automatic logger integration (static instances only).
   */
  sandbox?: TSandbox | WorkspaceSandboxResolver;

  /**
   * Controls how a resolver-backed `sandbox` contributes to workspace instructions.
   * Defaults to `dynamicSandbox: 'placeholder'`. No effect on a static sandbox.
   * See {@link DynamicSandboxInstructions}.
   */
  instructions?: {
    dynamicSandbox?: DynamicSandboxInstructions;
  };

  /**
   * Stable cache key for a resolver-backed `sandbox`, so background-process tools
   * reach the same sandbox across requests. No effect on a static sandbox.
   * See {@link WorkspaceSandboxCacheKey}.
   */
  sandboxCacheKey?: WorkspaceSandboxCacheKey;

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
  // Browser Configuration
  // ---------------------------------------------------------------------------

  /**
   * Browser provider for web automation.
   *
   * Must be a `MastraBrowser` instance with `providerType: 'cli'` (e.g., `BrowserViewer`).
   * SDK providers (`AgentBrowser`, `StagehandBrowser`) are not supported here —
   * use `Agent.browser` for SDK providers.
   *
   * The browser is launched via Playwright and exposes a CDP URL that CLI tools
   * (`agent-browser`, `browser-use`, `browse`) can connect to.
   *
   * @example
   * ```typescript
   * import { BrowserViewer } from '@mastra/browser-viewer';
   *
   * const workspace = new Workspace({
   *   sandbox: new LocalSandbox({ cwd: './workspace' }),
   *   browser: new BrowserViewer({
   *     cli: 'agent-browser',
   *     headless: false,
   *   }),
   * });
   * ```
   */
  browser?: MastraBrowser;

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
   * Pass `true` for defaults, a {@link BM25Config} for custom k1/b parameters,
   * or a `{ bm25?, tokenize? }` object to also customise tokenization.
   *
   * The `tokenize` field accepts a {@link TokenizeOptions} object that lets you
   * tune how text is split into tokens (e.g. for CJK or other non-Latin scripts).
   *
   * @example
   * ```ts
   * new Workspace({
   *   bm25: {
   *     k1: 1.5,
   *     b: 0.75,
   *     tokenize: { removePunctuation: false, minLength: 1 },
   *   },
   * });
   * ```
   */
  bm25?: boolean | BM25Config | { bm25?: BM25Config; tokenize?: TokenizeOptions };

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
   * @example ['docs', 'support']
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
   * skills: ['skills', 'node_modules/@myorg/skills']
   * ```
   *
   * @example Dynamic paths
   * ```typescript
   * skills: (ctx) => {
   *   const tier = ctx.requestContext?.get('userTier');
   *   return tier === 'premium'
   *     ? ['skills/basic', 'skills/premium']
   *     : ['skills/basic'];
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
   *   skills: ['skills'],
   *   skillSource: new VersionedSkillSource(tree, blobStore, versionCreatedAt),
   * });
   * ```
   */
  skillSource?: SkillSource;

  /**
   * Check SKILL.md file mtime in addition to directory mtime for staleness detection.
   *
   * When enabled, allows hot-reload detection of in-place SKILL.md edits
   * (e.g., fixing a validation error or updating a skill description).
   *
   * Trade-off: This doubles the stat() calls per skill during staleness checks.
   * Recommended for local development only. Not recommended for cloud storage
   * backends (S3, etc.) where stat() calls have higher latency.
   *
   * @default false
   */
  checkSkillFileMtime?: boolean;

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

/** A workspace entry in the Mastra registry, enriched with source metadata. */
export interface RegisteredWorkspace {
  workspace: Workspace;
  source: 'mastra' | 'agent';
  agentId?: string;
  agentName?: string;
}

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

/**
 * Maximum concurrent `readFile` calls when batch-loading files for search auto-indexing
 * (`batchReadFiles`).
 */
const FS_READ_CONCURRENCY = 8;

/**
 * Parse the user-facing `bm25` config union into the `BM25SearchConfig` shape
 * that `SearchEngine` expects.
 */
function parseBM25Config(
  bm25: boolean | BM25Config | { bm25?: BM25Config; tokenize?: TokenizeOptions },
): BM25SearchConfig {
  if (typeof bm25 === 'boolean') return {};
  if ('bm25' in bm25 || 'tokenize' in bm25) {
    return {
      bm25: (bm25 as { bm25?: BM25Config }).bm25,
      tokenize: (bm25 as { tokenize?: TokenizeOptions }).tokenize,
    };
  }
  return { bm25: bm25 as BM25Config };
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
  private _destroyPromise?: Promise<void>;
  private readonly _fs?: WorkspaceFilesystem;
  private readonly _filesystemResolver?: WorkspaceFilesystemResolver;
  private readonly _sandbox?: WorkspaceSandbox;
  private readonly _sandboxResolver?: WorkspaceSandboxResolver;
  // Per-request memoization so one resolver call serves both instructions and tool execution.
  private readonly _filesystemRequestCache = new WeakMap<RequestContext, Promise<WorkspaceFilesystem>>();
  private readonly _sandboxRequestCache = new WeakMap<RequestContext, Promise<WorkspaceSandbox>>();
  // Resolver memoization keyed by sandboxCacheKey (survives RequestContext churn).
  private readonly _sandboxKeyCache = new Map<string, Promise<WorkspaceSandbox>>();
  private readonly _sandboxCacheKey?: WorkspaceSandboxCacheKey;
  private readonly _dynamicSandboxInstructions: DynamicSandboxInstructions;
  private readonly _browser?: MastraBrowser;
  private readonly _config: WorkspaceConfig<TFilesystem, TSandbox, TMounts>;
  private readonly _searchEngine?: SearchEngine;
  private _skills?: WorkspaceSkills;
  private _lsp?: LSPManager;
  private _logger?: IMastraLogger;

  constructor(config: WorkspaceConfig<TFilesystem, TSandbox, TMounts>) {
    this.id = config.id ?? this.generateId();
    this.name = config.name ?? `workspace-${this.id.slice(0, 8)}`;
    this.createdAt = new Date();
    this.lastAccessedAt = new Date();

    this._config = config;

    if (typeof config.sandbox === 'function') {
      this._sandboxResolver = config.sandbox as WorkspaceSandboxResolver;
    } else {
      this._sandbox = config.sandbox;
    }
    this._sandboxCacheKey = config.sandboxCacheKey;
    this._dynamicSandboxInstructions = config.instructions?.dynamicSandbox ?? 'placeholder';

    // Setup mounts - creates CompositeFilesystem and informs sandbox
    if (config.mounts && Object.keys(config.mounts).length > 0) {
      // Validate: can't use both filesystem and mounts
      if (config.filesystem) {
        throw new WorkspaceError('Cannot use both "filesystem" and "mounts"', 'INVALID_CONFIG');
      }
      if (this._sandboxResolver) {
        throw new WorkspaceError(
          'Cannot use "mounts" with a dynamic sandbox resolver. ' +
            'Mounts are attached to a sandbox instance at construction time. ' +
            'Either pass a static sandbox instance, or have your resolver return a sandbox with its mounts already configured.',
          'INVALID_CONFIG',
        );
      }

      // Warn: contained: false is incompatible with mounts
      for (const [mountPath, fs] of Object.entries(config.mounts)) {
        if (fs instanceof LocalFilesystem && !fs.contained) {
          console.warn(
            `[Workspace] LocalFilesystem at mount "${mountPath}" has contained: false, which is incompatible with mounts. ` +
              `CompositeFilesystem strips mount prefixes and produces absolute paths (e.g. "/file.txt"), ` +
              `which a non-contained LocalFilesystem interprets as real host paths instead of paths ` +
              `relative to basePath. Use contained: true (default) or allowedPaths for specific exceptions.`,
          );
        }
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
    } else if (typeof config.filesystem === 'function') {
      // Reject class constructors — a common mistake is passing the class itself instead of an instance
      if (/^class\s/.test(Function.prototype.toString.call(config.filesystem))) {
        throw new WorkspaceError(
          'filesystem received a class constructor instead of an instance or resolver function. ' +
            'Pass an instance (e.g., new LocalFilesystem(...)) or a resolver function (({ requestContext }) => fs).',
          'INVALID_CONFIG',
        );
      }
      // Dynamic filesystem resolver — stored separately, no static _fs instance
      this._filesystemResolver = config.filesystem as WorkspaceFilesystemResolver;
    } else {
      this._fs = config.filesystem;
    }

    // Validate and store browser provider
    if (config.browser) {
      if (config.browser.providerType !== 'cli') {
        throw new WorkspaceError(
          `Workspace.browser requires a CLI provider (providerType: 'cli'), but got '${config.browser.providerType}'. ` +
            `SDK providers should be used with Agent.browser instead.`,
          'INVALID_CONFIG',
          this.id,
        );
      }
      this._browser = config.browser;
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
        bm25: config.bm25 ? parseBM25Config(config.bm25) : undefined,
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
      if (this._sandboxResolver) {
        console.warn(
          `[Workspace "${this.name}"] lsp: true is incompatible with a dynamic sandbox resolver — LSP needs a process manager at construction time, but the sandbox is resolved per request. LSP disabled.`,
        );
      } else if (!this._sandbox) {
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
    if (!this._fs && !this._filesystemResolver && !this._sandbox && !this._sandboxResolver && !this.hasSkillsConfig()) {
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
   * The browser provider (if configured).
   *
   * Returns the MastraBrowser instance (must be a CLI provider like BrowserViewer).
   */
  get browser(): MastraBrowser | undefined {
    return this._browser;
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
   * Returns true if a filesystem is configured, either as a static instance or a resolver function.
   */
  hasFilesystemConfig(): boolean {
    return this._fs !== undefined || this._filesystemResolver !== undefined;
  }

  /**
   * Resolve the filesystem for a given request context.
   * When a resolver function is configured, calls it with the provided requestContext.
   * When a static filesystem is configured, returns it directly.
   * Returns undefined if no filesystem is configured.
   */
  async resolveFilesystem({
    requestContext,
  }: {
    requestContext: RequestContext;
  }): Promise<WorkspaceFilesystem | undefined> {
    if (!this._filesystemResolver) return this._fs;
    let pending = this._filesystemRequestCache.get(requestContext);
    if (!pending) {
      pending = Promise.resolve(this._filesystemResolver({ requestContext }));
      this._filesystemRequestCache.set(requestContext, pending);
    }
    return pending;
  }

  /**
   * Returns true if a sandbox is configured, either as a static instance or a resolver function.
   */
  hasSandboxConfig(): boolean {
    return this._sandbox !== undefined || this._sandboxResolver !== undefined;
  }

  /**
   * Returns true when the sandbox is resolved dynamically per request.
   */
  hasSandboxResolver(): boolean {
    return this._sandboxResolver !== undefined;
  }

  /**
   * Returns true when resolver-backed sandboxes are cached by a stable key.
   */
  hasSandboxCacheKey(): boolean {
    return this._sandboxCacheKey !== undefined;
  }

  /**
   * Resolve the sandbox for a given request context. Calls the resolver function
   * if configured, otherwise returns the static sandbox (or undefined). Results
   * are memoized by `sandboxCacheKey` when set, else per RequestContext instance.
   */
  async resolveSandbox({ requestContext }: { requestContext: RequestContext }): Promise<WorkspaceSandbox | undefined> {
    if (!this._sandboxResolver) return this._sandbox;

    const cacheKey = this._sandboxCacheKey?.({ requestContext });
    if (cacheKey != null) {
      let keyed = this._sandboxKeyCache.get(cacheKey);
      if (!keyed) {
        keyed = Promise.resolve().then(() => this._sandboxResolver!({ requestContext }));
        this._sandboxKeyCache.set(cacheKey, keyed);
        keyed.catch(() => {
          if (this._sandboxKeyCache.get(cacheKey) === keyed) {
            this._sandboxKeyCache.delete(cacheKey);
          }
        });
      }
      return keyed;
    }

    let pending = this._sandboxRequestCache.get(requestContext);
    if (!pending) {
      pending = Promise.resolve().then(() => this._sandboxResolver!({ requestContext }));
      this._sandboxRequestCache.set(requestContext, pending);
      pending.catch(() => {
        if (this._sandboxRequestCache.get(requestContext) === pending) {
          this._sandboxRequestCache.delete(requestContext);
        }
      });
    }
    return pending;
  }

  /**
   * Clear cached resolver-backed sandboxes stored by `sandboxCacheKey`.
   *
   * This only clears the keyed cache. Per-RequestContext WeakMap entries are
   * garbage-collection managed and cannot be cleared by this method.
   *
   * The workspace does not own resolver-returned sandboxes, so this only drops
   * references from the workspace cache. Callers remain responsible for
   * destroying any sandbox instances they created.
   */
  clearSandboxCache(cacheKey?: string): void {
    if (cacheKey === undefined) {
      this._sandboxKeyCache.clear();
      return;
    }
    this._sandboxKeyCache.delete(cacheKey);
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
   * const skill = await workspace.skills?.get('skills/brand-guidelines');
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
        checkSkillFileMtime: this._config.checkSkillFileMtime,
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
   * Paths can be plain directories, single files, or glob patterns.
   * Uses resolvePathPattern for unified resolution: file matches are
   * indexed directly, directory matches are recursed.
   */
  private async rebuildSearchIndex(paths: string[]): Promise<void> {
    if (!this._searchEngine || !this._fs || paths.length === 0) {
      return;
    }

    // Clear existing BM25 index
    this._searchEngine.clear();

    // Adapt filesystem readdir to the ReaddirEntry interface
    const readdir = async (dir: string): Promise<ReaddirEntry[]> => {
      const entries = await this._fs!.readdir(dir);
      return entries.map(e => ({ name: e.name, type: e.type, isSymlink: e.isSymlink }));
    };

    // Index all files from specified paths (track across patterns to avoid re-indexing overlaps)
    const indexedPaths = new Set<string>();
    for (const pathOrGlob of paths) {
      try {
        const resolved = await resolvePathPattern(pathOrGlob, readdir);
        const filesToIndex = new Set<string>();
        const directoryRoots: string[] = [];
        for (const entry of resolved) {
          if (entry.type === 'file') {
            filesToIndex.add(entry.path);
            continue;
          }
          // Skip directories already covered by a parent directory
          const alreadyCovered = directoryRoots.some(root => entry.path === root || entry.path.startsWith(`${root}/`));
          if (!alreadyCovered) directoryRoots.push(entry.path);
        }
        // Index direct file matches first so they aren't lost if a directory scan fails
        const indexed = await this.indexFilesForSearch(
          Array.from(filesToIndex).filter(filePath => !indexedPaths.has(filePath)),
        );
        for (const filePath of indexed) indexedPaths.add(filePath);

        for (const dir of directoryRoots) {
          try {
            const files = (await this.getAllFiles(dir)).filter(filePath => !indexedPaths.has(filePath));
            const indexed = await this.indexFilesForSearch(files);
            for (const filePath of indexed) indexedPaths.add(filePath);
          } catch {
            // Skip directories that can't be read
          }
        }
      } catch {
        // Skip paths that don't exist or can't be read
      }
    }
  }

  /**
   * Load file contents for search indexing in parallel (bounded by {@link FS_READ_CONCURRENCY}).
   * Paths that cannot be read as UTF-8 text are omitted (same behavior as {@link indexFileForSearch}).
   */
  private async batchReadFiles(files: string[]): Promise<Array<{ filePath: string; docs: IndexDocument[] }>> {
    if (!this._fs || files.length === 0) {
      return [];
    }

    const fs = this._fs;
    return pMap(
      files,
      async (filePath): Promise<{ filePath: string; docs: IndexDocument[] } | typeof pMapSkip> => {
        try {
          const content = (await fs.readFile(filePath, { encoding: 'utf-8' })) as string;
          const chunks = splitIntoChunks(content);
          const docs: IndexDocument[] =
            chunks.length === 1
              ? [{ id: filePath, content }]
              : chunks.map((chunk, i) => ({
                  id: `${filePath}#chunk-${i}`,
                  content: chunk.content,
                  startLineOffset: chunk.startLine,
                  metadata: { sourceFile: filePath },
                }));
          return { filePath, docs };
        } catch {
          return pMapSkip;
        }
      },
      { stopOnError: false, concurrency: FS_READ_CONCURRENCY },
    );
  }

  /**
   * Batch-read paths and {@link SearchEngine.indexMany}
   *
   * @returns paths that were indexed successfully.
   * @remarks Falls back to one-at-a-time indexing on failure of {@link SearchEngine.indexMany}
   */
  private async indexFilesForSearch(paths: string[]): Promise<string[]> {
    const engine = this._searchEngine;
    if (!engine) return [];
    try {
      const entries = await this.batchReadFiles(paths);
      // Clear stale single-doc/chunked entries from previous indexing passes.
      await pMap(entries, ({ filePath }) => engine.removeSource(filePath), {
        concurrency: FS_READ_CONCURRENCY,
      });
      const docs = entries.flatMap(({ docs }) => docs);
      await engine.indexMany(docs);
      return entries.map(({ filePath }) => filePath);
    } catch {
      const indexed: string[] = [];
      for (const filePath of paths) {
        const id = await this.indexFileForSearch(filePath);
        if (id !== undefined) {
          indexed.push(id);
        }
      }
      return indexed;
    }
  }

  /**
   * Index a single file for search. Skips files that can't be read as text.
   * Large files are automatically split into chunks to stay within embedding
   * model token limits.
   *
   * @returns `filePath` when indexed, or `undefined` if read/index failed.
   */
  private async indexFileForSearch(filePath: string): Promise<string | undefined> {
    let content: string;
    try {
      content = (await this._fs!.readFile(filePath, { encoding: 'utf-8' })) as string;
    } catch {
      // Skip files that can't be read as text (e.g. binary files, invalid UTF-8)
      return;
    }

    // Clear stale single-doc/chunked entries from previous indexing passes.
    await this._searchEngine!.removeSource(filePath);

    const chunks = splitIntoChunks(content);

    if (chunks.length === 1) {
      try {
        await this._searchEngine!.index({ id: filePath, content });
        return filePath;
      } catch (error) {
        this._logger?.warn(`Failed to index file "${filePath}" for search`, { error });
        return;
      }
    }

    let anyIndexed = false;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      try {
        await this._searchEngine!.index({
          id: `${filePath}#chunk-${i}`,
          content: chunk.content,
          startLineOffset: chunk.startLine,
          metadata: { sourceFile: filePath },
        });
        anyIndexed = true;
      } catch (error) {
        this._logger?.warn(`Failed to index chunk ${i} of file "${filePath}" for search`, { error });
      }
    }
    return anyIndexed ? filePath : undefined;
  }

  private async getAllFiles(
    dir: string,
    depth: number = 0,
    maxDepth: number = 10,
    filesystem: WorkspaceFilesystem | undefined = this._fs,
  ): Promise<string[]> {
    if (!filesystem || depth >= maxDepth) return [];

    const files: string[] = [];
    const entries = await filesystem.readdir(dir);

    for (const entry of entries) {
      const fullPath = dir === '.' || dir === '' ? entry.name : `${dir}/${entry.name}`;
      if (entry.type === 'file') {
        files.push(fullPath);
      } else if (entry.type === 'directory' && !entry.isSymlink) {
        // Skip symlink directories to prevent infinite recursion from cycles
        files.push(...(await this.getAllFiles(fullPath, depth + 1, maxDepth, filesystem)));
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
   *
   * Resolver-backed providers are skipped because there is no instance until
   * the resolver runs.
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

      // Note: Browser is NOT launched here - it's launched lazily in execute-command
      // when a browser CLI command is detected. This matches SDK provider behavior
      // and enables thread-scoped browsers.

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
    if (this._status === 'destroyed') {
      return;
    }
    if (this._status === 'destroying' && this._destroyPromise) {
      return await this._destroyPromise;
    }

    this._status = 'destroying';
    this._destroyPromise = this._performDestroy();

    try {
      await this._destroyPromise;
    } finally {
      this._destroyPromise = undefined;
    }
  }

  private async _performDestroy(): Promise<void> {
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

      // Close browser before sandbox
      if (this._browser) {
        try {
          await this._browser.close();
        } catch {
          // Browser close errors are non-blocking
        }
      }

      if (this._sandbox) {
        await callLifecycle(this._sandbox, 'destroy');
      }

      if (this._fs) {
        await callLifecycle(this._fs, 'destroy');
      }

      this.clearSandboxCache();

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
  async getInfo(options?: {
    includeFileCount?: boolean;
    requestContext?: RequestContext;
    resolveDynamicProviders?: boolean;
  }): Promise<WorkspaceInfo> {
    const info: WorkspaceInfo = {
      id: this.id,
      name: this.name,
      status: this._status,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
    };

    const shouldResolveDynamicProviders = options?.resolveDynamicProviders ?? true;
    // Prefer a provider already resolved for this request. When getInfo runs on
    // the effective workspace proxy during tool execution, `this.filesystem` is
    // the resolved instance, so metadata stays accurate without re-resolving.
    const filesystem =
      (this.filesystem as WorkspaceFilesystem | undefined) ??
      (this._filesystemResolver && shouldResolveDynamicProviders
        ? await this.resolveFilesystem({ requestContext: options?.requestContext ?? new RequestContext() })
        : undefined);

    if (filesystem) {
      const fsInfo = await filesystem.getInfo?.();
      info.filesystem = {
        id: fsInfo?.id ?? filesystem.id,
        name: fsInfo?.name ?? filesystem.name,
        provider: fsInfo?.provider ?? filesystem.provider,
        readOnly: fsInfo?.readOnly ?? filesystem.readOnly,
        status: fsInfo?.status,
        error: fsInfo?.error,
        icon: fsInfo?.icon,
        metadata: fsInfo?.metadata,
      };

      if (options?.includeFileCount) {
        try {
          const files = await this.getAllFiles('.', 0, 10, filesystem);
          info.filesystem.totalFiles = files.length;
        } catch {
          // Ignore errors - filesystem may not support listing
        }
      }
    } else if (this._filesystemResolver) {
      info.filesystem = {
        id: `${this.id}-dynamic-filesystem`,
        name: 'DynamicFilesystem',
        provider: 'dynamic',
        status: 'pending',
      };
    }

    // `this.sandbox` picks up a sandbox already resolved for this request when
    // getInfo runs on the effective workspace proxy. getInfo never invokes the
    // sandbox resolver itself — resolver-backed sandboxes can provision real
    // infrastructure, so resolving stays a tool-execution concern.
    const sandbox = this.sandbox as WorkspaceSandbox | undefined;
    if (sandbox) {
      const sandboxInfo = await sandbox.getInfo?.();
      info.sandbox = {
        provider: sandbox.provider,
        status: sandboxInfo?.status ?? sandbox.status,
        resources: sandboxInfo?.resources,
      };
    } else if (this._sandboxResolver) {
      info.sandbox = { provider: 'dynamic', status: 'pending' };
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
  private getInstructionsForProviders(
    filesystem: WorkspaceFilesystem | undefined,
    sandbox: WorkspaceSandbox | undefined,
    opts?: { requestContext?: RequestContext },
  ): string {
    const parts: string[] = [];

    // Sandbox-level instructions (working directory, provider type)
    const sandboxInstructions = sandbox?.getInstructions?.(opts);
    if (sandboxInstructions) parts.push(sandboxInstructions);

    // Mount state overlay: check actual MountManager state
    const mountEntries = sandbox?.mounts?.entries;
    if (mountEntries && mountEntries.size > 0) {
      const sandboxAccessible: string[] = [];
      const workspaceOnly: string[] = [];
      const workingDir = sandbox instanceof LocalSandbox ? sandbox.workingDirectory : undefined;

      for (const [mountPath, entry] of mountEntries) {
        const fsName = entry.filesystem.displayName || entry.filesystem.provider;
        const access = entry.filesystem.readOnly ? 'read-only' : 'read-write';

        // Resolve mount path against workingDirectory when available
        // so the LLM sees the actual usable path (e.g. /tmp/sandbox/s3 instead of /s3)
        const displayPath = workingDir ? path.join(workingDir, mountPath.replace(/^\/+/, '')) : mountPath;

        if (entry.state === 'mounted' || entry.state === 'pending' || entry.state === 'mounting') {
          // mounted: ready now. pending/mounting: will be ready when sandbox starts
          // (executeCommand triggers ensureRunning which processes pending mounts)
          sandboxAccessible.push(`  - ${displayPath}: ${fsName} (${access})`);
        } else {
          // error, unsupported, unavailable — NOT accessible in sandbox
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
      const fsInstructions = filesystem?.getInstructions?.(opts);
      if (fsInstructions) parts.push(fsInstructions);
    }

    return parts.join('\n\n');
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    return this.getInstructionsForProviders(this._fs, this._sandbox, opts);
  }

  /**
   * Get human-readable instructions describing the workspace environment.
   *
   * Resolves a dynamic filesystem per request. A resolver-backed sandbox is not
   * resolved here unless `instructions.dynamicSandbox` is `'resolve'`.
   */
  async getInstructionsAsync(opts?: { requestContext?: RequestContext }): Promise<string> {
    const requestContext = opts?.requestContext ?? new RequestContext();
    const filesystem = this._filesystemResolver ? await this.resolveFilesystem({ requestContext }) : this._fs;
    const resolvedOpts = { ...opts, requestContext };

    // Resolver-backed sandbox: emit placeholder text without calling the resolver.
    if (this._sandboxResolver && this._dynamicSandboxInstructions !== 'resolve') {
      const sandboxText =
        typeof this._dynamicSandboxInstructions === 'function'
          ? this._dynamicSandboxInstructions({ requestContext })
          : DYNAMIC_SANDBOX_INSTRUCTIONS;
      const fsText = this.getInstructionsForProviders(filesystem, undefined, resolvedOpts);
      return [sandboxText, fsText].filter(Boolean).join('\n\n');
    }

    const sandbox = this._sandboxResolver ? await this.resolveSandbox({ requestContext }) : this._sandbox;
    return this.getInstructionsForProviders(filesystem, sandbox, resolvedOpts);
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
    return this.getPathContextForProviders(this._fs, this._sandbox);
  }

  private getPathContextForProviders(
    filesystem: WorkspaceFilesystem | undefined,
    sandbox: WorkspaceSandbox | undefined,
  ): PathContext {
    const fsInstructions = filesystem?.getInstructions?.();
    const sandboxInstructions = sandbox?.getInstructions?.();

    return {
      filesystem: filesystem
        ? {
            provider: filesystem.provider,
            basePath: filesystem.basePath,
          }
        : undefined,
      sandbox: sandbox
        ? {
            provider: sandbox.provider,
            workingDirectory: sandbox instanceof LocalSandbox ? sandbox.workingDirectory : undefined,
          }
        : undefined,
      instructions: [fsInstructions, sandboxInstructions].filter(Boolean).join(' '),
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
    this._logger = logger;

    // Propagate logger to filesystem provider if it extends MastraFilesystem
    // Skip when using a resolver — no static instance to set logger on
    if (this._fs instanceof MastraFilesystem) {
      this._fs.__setLogger(logger);
    }

    // Propagate logger to sandbox provider if it extends MastraSandbox
    if (this._sandbox instanceof MastraSandbox) {
      this._sandbox.__setLogger(logger);
    }
  }
}
