// Compatibility helpers
export { isWorkspaceV1Supported, isWorkspaceNotSupportedError } from '../compatibility';

// Workspace hooks - filesystem and search
export {
  useWorkspaceInfo,
  useWorkspaces,
  useWorkspaceFileStat,
  useWriteWorkspaceFile,
  useWriteWorkspaceFileFromFile,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
  useIndexWorkspaceContent,
} from './use-workspace';

// Stored workspace hooks
export { useStoredWorkspaces } from './use-stored-workspaces';

// Skills hooks
export { useWorkspaceSkills, useWorkspaceSkillReferences, useAgentSkill } from './use-workspace-skills';

// Skills.sh hooks
export {
  useInstallSkill,
  useUpdateSkills,
  useRemoveSkill,
  type InstallSkillParams,
  type UpdateSkillsParams,
  type RemoveSkillParams,
} from './use-skills-sh';
