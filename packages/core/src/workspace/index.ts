/**
 * Workspace Module
 *
 * Provides the core Workspace class, interfaces, and built-in providers
 * for filesystem and sandbox capabilities.
 *
 * @example Local filesystem and sandbox
 * ```typescript
 * import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
 *
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
 * @example E2B cloud sandbox (requires @mastra/e2b)
 * ```typescript
 * import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new E2BSandbox({ timeout: 60000 }),
 * });
 * ```
 *
 * @example S3 filesystem with E2B (requires @mastra/e2b, @mastra/s3)
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox } from '@mastra/e2b';
 * import { S3Filesystem } from '@mastra/s3';
 *
 * // S3 filesystem can be mounted into E2B sandbox via s3fs-fuse
 * const workspace = new Workspace({
 *   filesystem: new S3Filesystem({
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   }),
 *   sandbox: new E2BSandbox({ timeout: 60000 }),
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
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
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
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  InstallPackageOptions,
  SandboxStatus,
  SandboxInfo,
} from './sandbox';

export {
  SandboxError,
  SandboxExecutionError,
  SandboxTimeoutError,
  SandboxNotReadyError,
  UnsupportedRuntimeError,
} from './sandbox';

export type { InstallPackageResult } from './sandbox';

// =============================================================================
// Mount Configuration Types
// =============================================================================

export type { FilesystemMountConfig } from './filesystem';
export type { LocalMountConfig } from './local-filesystem';

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
  DEFAULT_STOPWORDS,
  type BM25Config,
  type BM25Document,
  type BM25SearchResult,
  type BM25IndexData,
  type TokenizeOptions,
} from './bm25';

// =============================================================================
// Line Utilities
// =============================================================================

export {
  extractLines,
  extractLinesWithLimit,
  formatWithLineNumbers,
  findLineRange,
  charIndexToLineNumber,
  charRangeToLineRange,
  countOccurrences,
  replaceString,
  StringNotFoundError,
  StringNotUniqueError,
  type LineRange,
} from './line-utils';

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
