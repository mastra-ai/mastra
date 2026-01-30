// Compatibility helpers
export { isWorkspaceV1Supported, isWorkspaceNotSupportedError } from '../compatibility';

// Workspace hooks - filesystem and search
export {
  useWorkspaceInfo,
  useWorkspaces,
  useWorkspaceFiles,
  useWorkspaceFile,
  useWorkspaceFileStat,
  useWriteWorkspaceFile,
  useWriteWorkspaceFileFromFile,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
  useSearchWorkspace,
  useIndexWorkspaceContent,
} from './use-workspace';

// Skills hooks
export {
  useWorkspaceSkills,
  useWorkspaceSkill,
  useWorkspaceSkillReferences,
  useWorkspaceSkillReference,
  useSearchWorkspaceSkills,
  useAgentSkill,
} from './use-workspace-skills';
