/**
 * Workspace Module
 *
 * Provides the core Workspace class, interfaces, and built-in providers
 * for filesystem and sandbox capabilities.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';
 *
 * // Workspace with local filesystem and sandbox
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new LocalSandbox({ workingDirectory: './my-workspace' }),
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/hello.txt', 'Hello World!');
 * const result = await workspace.executeCode('console.log("Hi")', { runtime: 'node' });
 * ```
 *
 * For cloud/remote providers, import them from their respective packages:
 *
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { AgentFS } from '@mastra/filesystem-agentfs';
 * import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';
 *
 * const cloudWorkspace = new Workspace({
 *   filesystem: new AgentFS({ path: './agent.db' }),
 *   sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
 * });
 * ```
 */

// =============================================================================
// Workspace (Main API)
// =============================================================================

export {
  Workspace,
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SearchNotAvailableError,
  WorkspaceNotReadyError,
  WorkspaceReadOnlyError,
  type WorkspaceConfig,
  type WorkspaceSafetyConfig,
  type WorkspaceScope,
  type WorkspaceOwner,
  type WorkspaceStatus,
  type WorkspaceInfo,
  type SyncResult,
  type SnapshotOptions,
  type WorkspaceSnapshot,
  type RestoreOptions,
  type PathContext,
  type PathContextType,
} from './workspace';

// =============================================================================
// Filesystem Interface (for provider implementers)
// =============================================================================

export type {
  WorkspaceFilesystem,
  WorkspaceState,
  WorkspaceFilesystemAudit,
  SharedFilesystemOptions,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  MkdirOptions,
  StatOptions,
  ExistsOptions,
  PathCheckOptions,
  WatchEvent,
  WatchCallback,
  WatchOptions,
  WatchHandle,
  FilesystemAuditEntry,
  FilesystemAuditOptions,
} from './filesystem';

export {
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
  FileReadRequiredError,
} from './filesystem';

// =============================================================================
// File Read Tracking (for safety features)
// =============================================================================

export type { FileReadRecord, FileReadTracker } from './file-read-tracker';
export { InMemoryFileReadTracker } from './file-read-tracker';

// =============================================================================
// Sandbox Interface (for provider implementers)
// =============================================================================

export type {
  WorkspaceSandbox,
  SandboxRuntime,
  ExecutionResult,
  CommandResult,
  CodeResult,
  StreamingExecutionResult,
  SharedSandboxOptions,
  SandboxIdContext,
  SandboxIdResolver,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  InstallPackageResult,
  SandboxStartOptions,
  SandboxStopOptions,
  SandboxDestroyOptions,
  SandboxStatus,
  SandboxInfo,
} from './sandbox';

export {
  resolveSandboxId,
  SandboxError,
  SandboxExecutionError,
  SandboxTimeoutError,
  SandboxNotReadyError,
  UnsupportedRuntimeError,
} from './sandbox';

// =============================================================================
// Built-in Providers
// =============================================================================

export { LocalFilesystem, type LocalFilesystemOptions } from './local-filesystem';
export { LocalSandbox, type LocalSandboxOptions } from './local-sandbox';

// =============================================================================
// Workspace Tools (for agent auto-injection)
// =============================================================================

export { createWorkspaceTools, WORKSPACE_TOOL_NAMES } from './tools';

// =============================================================================
// Search Engine (BM25, Vector, Hybrid search)
// =============================================================================

export {
  SearchEngine,
  type Embedder,
  type VectorConfig,
  type BM25SearchConfig,
  type IndexDocument,
  type SearchResult,
  type SearchOptions,
  type SearchEngineConfig,
  type SearchMode,
} from './search-engine';

// =============================================================================
// BM25 Index (for advanced use cases)
// =============================================================================

export {
  BM25Index,
  tokenize,
  findLineRange,
  extractLines,
  charIndexToLineNumber,
  charRangeToLineRange,
  DEFAULT_STOPWORDS,
  type BM25Config,
  type BM25Document,
  type BM25SearchResult,
  type BM25IndexData,
  type TokenizeOptions,
  type LineRange,
} from './bm25';

// =============================================================================
// Skills (types, schemas, and implementation)
// =============================================================================

export type {
  SkillSource,
  SkillFormat,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  SkillSearchOptions,
  CreateSkillInput,
  UpdateSkillInput,
  WorkspaceSkills,
} from './skills';

export {
  SKILL_LIMITS,
  SkillNameSchema,
  SkillDescriptionSchema,
  SkillCompatibilitySchema,
  SkillLicenseSchema,
  SkillMetadataFieldSchema,
  SkillAllowedToolsSchema,
  SkillMetadataSchema,
  validateSkillMetadata,
  parseAllowedTools,
  type SkillMetadataInput,
  type SkillMetadataOutput,
  type SkillValidationResult,
  WorkspaceSkillsImpl,
  type WorkspaceSkillsImplConfig,
} from './skills';
