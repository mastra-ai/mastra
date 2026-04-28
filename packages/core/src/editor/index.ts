export type {
  IMastraEditor,
  MastraEditorConfig,
  GetByIdOptions,
  IEditorAgentNamespace,
  IEditorChannelNamespace,
  IEditorMCPNamespace,
  IEditorPromptNamespace,
  IEditorScorerNamespace,
  IEditorWorkspaceNamespace,
  IEditorSkillNamespace,
  FilesystemProvider,
  SandboxProvider,
  BlobStoreProvider,
} from './types';

// Re-export channel discovery types used by IEditorChannelNamespace
export type { ChannelPlatformInfo, ChannelInstallationInfo, ChannelConnectResult } from '../channels/types';
