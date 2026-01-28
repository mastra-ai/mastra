// Workspace
export {
  Workspace,
  type WorkspaceConfig,
  type WorkspaceStatus,
  type WorkspaceInfo,
  type PathContext,
  type PathContextType,
} from './workspace';

// Built-in Providers
export { LocalFilesystem, type LocalFilesystemOptions } from './filesystem';
export { LocalSandbox, type LocalSandboxOptions } from './sandbox';

// Errors
export {
  WorkspaceError,
  FilesystemNotAvailableError,
  SandboxNotAvailableError,
  SandboxFeatureNotSupportedError,
  SearchNotAvailableError,
  WorkspaceNotReadyError,
  WorkspaceReadOnlyError,
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
  FileReadRequiredError,
} from './errors';
export {
  SandboxError,
  SandboxExecutionError,
  SandboxTimeoutError,
  SandboxNotReadyError,
  IsolationUnavailableError,
} from './sandbox';

// Tools
export { createWorkspaceTools } from './tools/tools';
export {
  WORKSPACE_TOOLS,
  type WorkspaceToolConfig,
  type WorkspaceToolsConfig,
  type WorkspaceToolName,
} from './constants';

// Lifecycle
export type { Lifecycle, ProviderStatus } from './lifecycle';

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
  SkillSource,
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
