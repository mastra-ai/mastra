// Workspace
export * from './workspace';

// Built-in Providers
export { LocalFilesystem, type LocalFilesystemOptions } from './filesystem';
export { CompositeFilesystem, type CompositeFilesystemConfig } from './filesystem';
export { LocalSandbox, type LocalSandboxOptions } from './sandbox';

// Base Classes for External Providers
export { MastraFilesystem, type FilesystemLifecycleHook, type MastraFilesystemOptions } from './filesystem';
export { MastraSandbox, SandboxProcessManager, ProcessHandle } from './sandbox';

// Errors
export * from './errors';
export {
  SandboxError,
  SandboxExecutionError,
  SandboxTimeoutError,
  SandboxNotReadyError,
  IsolationUnavailableError,
  MountError,
  MountNotSupportedError,
  FilesystemNotMountableError,
  type SandboxOperation,
} from './sandbox';

// Tools
export {
  createWorkspaceTools,
  resolveToolConfig,
  type WorkspaceToolConfig,
  type WorkspaceToolsConfig,
  // Individual standalone tools
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  deleteFileTool,
  fileStatTool,
  mkdirTool,
  searchTool,
  indexContentTool,
  executeCommandTool,
  // Helpers
  requireWorkspace,
  requireFilesystem,
  requireSandbox,
} from './tools';

// Lifecycle
export * from './lifecycle';

// Filesystem
export type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  FilesystemInfo,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';

// Mount types (provider-specific configs are in their respective packages)
export type { FilesystemMountConfig, MountResult, FilesystemIcon } from './filesystem';

// Sandbox
export { MountManager } from './sandbox';
export type {
  WorkspaceSandbox,
  ExecutionResult,
  CommandOptions,
  CommandResult,
  ExecuteCommandOptions,
  SandboxInfo,
  SandboxLifecycleHook,
  MastraSandboxOptions,
  // Process management types
  ProcessInfo,
  SpawnProcessOptions,
} from './sandbox';
export type { MountManagerConfig, MountFn, OnMountHook, OnMountArgs, OnMountResult } from './sandbox';

// Native Sandbox
export type { IsolationBackend, NativeSandboxConfig, SandboxDetectionResult } from './sandbox';
export { detectIsolation, isIsolationAvailable, getRecommendedIsolation } from './sandbox';

// Constants
export { WORKSPACE_TOOLS_PREFIX, WORKSPACE_TOOLS, type WorkspaceToolName } from './constants';

// Shared types
export type { InstructionsOption } from './types';

// Glob Utilities
export {
  isGlobPattern,
  extractGlobBase,
  createGlobMatcher,
  matchGlob,
  type GlobMatcher,
  type GlobMatcherOptions,
} from './glob';

// Skills
export type {
  SkillFormat,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  SkillSearchOptions,
  WorkspaceSkills,
  SkillsResolver,
  SkillsContext,
} from './skills';

// Skill Publishing
export type { SkillPublishResult } from './skills';
export { collectSkillForPublish, publishSkillFromSource } from './skills';

// Skill Source
export type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skills';
export { LocalSkillSource } from './skills';

// Versioned Skill Sources
export { VersionedSkillSource } from './skills';
export { CompositeVersionedSkillSource, type VersionedSkillEntry } from './skills';
