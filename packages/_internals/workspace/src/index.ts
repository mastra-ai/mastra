export {
  SETUP_MARKER_DIR,
  SETUP_MARKER_PATH,
  WORKSPACE_SETUP_MARKER_PATH,
  SETUP_FAILED_MARKER_PATH,
  repoSetupMarkerPath,
  normalizeSetupCommands,
  setupMarkerContent,
  setupMarkerCommand,
  guardedSetupCommand,
  type GuardedSetupCommandOptions,
} from './setup-marker';
export { repoCloneCommand, type RepoCloneCommandOptions } from './repo-clone';
export {
  FILE_COMMAND_EXIT,
  shellQuote,
  siblingTempPath,
  copyCommand,
  moveNoClobberCommand,
  appendFromCommand,
  linkNoClobberCommand,
  type CopyCommandOptions,
} from './file-commands';
export {
  FilesApiFilesystem,
  type FilesApi,
  type FilesApiEntry,
  type FilesApiErrorKind,
  type FilesCommandResult,
} from './files-api-filesystem';
export {
  CommandsApiProcessManager,
  CommandsApiProcessHandle,
  type CommandsApi,
  type CommandsApiHandle,
  type CommandsApiOperation,
  type CommandsApiProcessManagerOptions,
  type CommandsApiStreamOptions,
} from './commands-api-process-manager';
