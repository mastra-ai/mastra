// Workspace
export * from './workspace';

// Built-in Providers
export { LocalFilesystem, type LocalFilesystemOptions } from './filesystem';
export { LocalSandbox, type LocalSandboxOptions } from './sandbox';

// Errors
export * from './errors';
export {
  SandboxError,
  SandboxExecutionError,
  SandboxTimeoutError,
  SandboxNotReadyError,
  IsolationUnavailableError,
} from './sandbox';

// Tools
export { createWorkspaceTools, type WorkspaceToolConfig, type WorkspaceToolsConfig } from './tools';

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

// Sandbox
export type { WorkspaceSandbox, ExecutionResult, CommandResult, ExecuteCommandOptions, SandboxInfo } from './sandbox';

// Native Sandbox
export type { IsolationBackend, NativeSandboxConfig, SandboxDetectionResult } from './sandbox';
export { detectIsolation, isIsolationAvailable, getRecommendedIsolation } from './sandbox';

// Skills
export type {
  SkillFormat,
  SkillMetadata,
  Skill,
  SkillSearchResult,
  SkillSearchOptions,
  CreateSkillInput,
  UpdateSkillInput,
  WorkspaceSkills,
  SkillsResolver,
  SkillsContext,
} from './skills';
