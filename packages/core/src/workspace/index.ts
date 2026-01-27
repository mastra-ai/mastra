/**
 * Workspace Module
 *
 * Provides the core Workspace class, interfaces, and built-in providers
 * for filesystem and sandbox capabilities.
 *
 * ## API Stability
 *
 * This module exports three categories of APIs:
 *
 * ### Public API (Stable)
 * - `Workspace` class and its configuration types
 * - `LocalFilesystem` and `LocalSandbox` providers
 * - Error classes
 * - `createWorkspaceTools` for manual tool injection
 *
 * ### Provider Interface (Stable)
 * - `WorkspaceFilesystem` and `WorkspaceSandbox` interfaces
 * - Related types for building custom providers
 *
 * ### Internal API (Unstable)
 * - `SearchEngine`, `BM25Index` - search implementation details
 * - `InMemoryFileReadTracker` - safety feature internals
 * - Line utilities - edit tool internals
 * - `WorkspaceSkillsImpl` - skills implementation
 *
 * Internal APIs may change without notice. Use at your own risk.
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
 * const result = await workspace.executeCommand('cat', ['/hello.txt']);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// PUBLIC API - Workspace (Main Entry Point)
// =============================================================================

/**
 * The main Workspace class and its configuration types.
 * This is the primary API for creating and managing workspaces.
 *
 * @public
 */
export {
  Workspace,
  type WorkspaceConfig,
  type WorkspaceStatus,
  type WorkspaceInfo,
  type PathContext,
  type PathContextType,
} from './workspace';

// =============================================================================
// PUBLIC API - Built-in Providers
// =============================================================================

/**
 * LocalFilesystem stores files in a directory on the local disk.
 * Use this for development, testing, or single-machine deployments.
 *
 * @public
 */
export { LocalFilesystem, type LocalFilesystemOptions } from './local-filesystem';

/**
 * LocalSandbox executes commands on the local machine.
 * Use this for development, testing, or trusted local execution.
 *
 * @public
 */
export { LocalSandbox, type LocalSandboxOptions } from './local-sandbox';

// =============================================================================
// PUBLIC API - Errors
// =============================================================================

/**
 * Error classes for workspace operations.
 * These provide specific error types for different failure modes.
 *
 * @public
 */
export {
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SandboxFeatureNotSupportedError,
  SearchNotAvailableError,
  WorkspaceNotReadyError,
  WorkspaceReadOnlyError,
} from './errors';

/**
 * Filesystem-specific error classes.
 *
 * @public
 */
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

/**
 * Sandbox-specific error classes.
 *
 * @public
 */
export { SandboxError, SandboxExecutionError, SandboxTimeoutError, SandboxNotReadyError } from './sandbox';

// =============================================================================
// PUBLIC API - Tool Creation
// =============================================================================

/**
 * Creates workspace tools for agent injection.
 * Use this if you need to manually add workspace tools to an agent.
 *
 * @public
 */
export { createWorkspaceTools } from './tools';
export {
  WORKSPACE_TOOLS,
  type WorkspaceToolConfig,
  type WorkspaceToolsConfig,
  type WorkspaceToolName,
} from './constants';

// =============================================================================
// PROVIDER INTERFACE - Filesystem
// =============================================================================

/**
 * Filesystem interface and types for building custom providers.
 * Implement `WorkspaceFilesystem` to create a new storage backend.
 *
 * @public
 */
export type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';

// =============================================================================
// PROVIDER INTERFACE - Sandbox
// =============================================================================

/**
 * Sandbox interface and types for building custom providers.
 * Implement `WorkspaceSandbox` to create a new execution backend.
 *
 * @public
 */
export type {
  WorkspaceSandbox,
  ExecutionResult,
  CommandResult,
  ExecuteCommandOptions,
  SandboxStatus,
  SandboxInfo,
} from './sandbox';

// =============================================================================
// PROVIDER INTERFACE - Skills
// =============================================================================

/**
 * Skill types for building custom skill sources.
 * Implement `SkillSource` to create a new skill provider.
 *
 * @public
 */
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
  SkillsPathsResolver,
  SkillsPathsContext,
} from './skills';

// =============================================================================
// INTERNAL API - Search Engine
// =============================================================================

/**
 * Search engine implementation.
 *
 * @internal
 * @remarks
 * This is an internal API and may change without notice.
 * For search functionality, use `workspace.search()` instead.
 */
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
// INTERNAL API - BM25 Index
// =============================================================================

/**
 * BM25 search index implementation.
 *
 * @internal
 * @remarks
 * This is an internal API and may change without notice.
 * For search functionality, use `workspace.search()` instead.
 */
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
// INTERNAL API - File Read Tracking
// =============================================================================

/**
 * File read tracking for requireReadBeforeWrite safety feature.
 *
 * @internal
 * @remarks
 * This is an internal API and may change without notice.
 */
export type { FileReadRecord, FileReadTracker } from './file-read-tracker';
export { InMemoryFileReadTracker } from './file-read-tracker';

// =============================================================================
// INTERNAL API - Line Utilities
// =============================================================================

/**
 * Line manipulation utilities for edit tools.
 *
 * @internal
 * @remarks
 * This is an internal API and may change without notice.
 */
export {
  extractLines,
  extractLinesWithLimit,
  formatWithLineNumbers,
  findLineRange,
  replaceString,
  StringNotFoundError,
  StringNotUniqueError,
} from './line-utils';

// =============================================================================
// INTERNAL API - Skills Implementation
// =============================================================================

/**
 * Skills validation and implementation.
 *
 * @internal
 * @remarks
 * This is an internal API and may change without notice.
 * For skills functionality, use `workspace.skills` instead.
 */
export {
  SKILL_LIMITS,
  SkillNameSchema,
  SkillDescriptionSchema,
  SkillCompatibilitySchema,
  SkillLicenseSchema,
  SkillMetadataFieldSchema,
  SkillMetadataSchema,
  validateSkillMetadata,
  type SkillMetadataInput,
  type SkillMetadataOutput,
  type SkillValidationResult,
  WorkspaceSkillsImpl,
  type WorkspaceSkillsImplConfig,
} from './skills';
