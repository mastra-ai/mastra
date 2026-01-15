// Workspace hooks - filesystem and search (unique names, no conflicts)
export {
  type WorkspaceCapabilities,
  type WorkspaceInfo,
  type FileEntry,
  type FileReadResponse,
  type FileListResponse,
  type FileStatResponse,
  type WriteFileParams,
  type WriteFileFromFileParams,
  type SearchWorkspaceParams,
  useWorkspaceInfo,
  useWorkspaceFiles,
  useWorkspaceFile,
  useWorkspaceFileStat,
  useWriteWorkspaceFile,
  useWriteWorkspaceFileFromFile,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
  useSearchWorkspace,
  useIndexWorkspaceContent,
  useUnindexWorkspaceContent,
} from './use-workspace';

// Re-export search types with Workspace prefix to avoid conflicts with knowledge domain
export type { SearchResult as WorkspaceSearchResult, SearchResponse as WorkspaceSearchResponse } from './use-workspace';

// Skills hooks - hooks have unique names, types renamed to avoid conflicts
export {
  useWorkspaceSkills,
  useWorkspaceSkill,
  useWorkspaceSkillReferences,
  useWorkspaceSkillReference,
  useSearchWorkspaceSkills,
  // useAgentSkill renamed to avoid conflict with skills domain
  useAgentSkill as useWorkspaceAgentSkill,
} from './use-workspace-skills';

// Re-export skill types with Workspace prefix to avoid conflicts with skills domain
export type {
  SkillSource as WorkspaceSkillSource,
  SkillMetadata as WorkspaceSkillMetadata,
  Skill as WorkspaceSkill,
  ListSkillsResponse as WorkspaceListSkillsResponse,
  SkillSearchResult as WorkspaceSkillSearchResult,
  SearchSkillsResponse as WorkspaceSearchSkillsResponse,
  ListReferencesResponse as WorkspaceListReferencesResponse,
  GetReferenceResponse as WorkspaceGetReferenceResponse,
  SearchSkillsParams as WorkspaceSearchSkillsParams,
} from './use-workspace-skills';
