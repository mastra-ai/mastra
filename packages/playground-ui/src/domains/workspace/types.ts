// =============================================================================
// Workspace Types
// =============================================================================

export interface WorkspaceCapabilities {
  hasFilesystem: boolean;
  hasSandbox: boolean;
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;
  hasSkills: boolean;
}

export interface WorkspaceSafety {
  readOnly: boolean;
}

export interface WorkspaceFilesystemInfo {
  id: string;
  name: string;
  provider: string;
  status?: string;
  error?: string;
  readOnly?: boolean;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkspaceInfo {
  isWorkspaceConfigured: boolean;
  id?: string;
  name?: string;
  status?: string;
  capabilities?: WorkspaceCapabilities;
  safety?: WorkspaceSafety;
  filesystem?: WorkspaceFilesystemInfo;
  mounts?: MountInfo[];
}

export interface WorkspaceItem {
  id: string;
  name: string;
  status: string;
  source: 'mastra' | 'agent';
  agentId?: string;
  agentName?: string;
  capabilities: WorkspaceCapabilities;
  safety: WorkspaceSafety;
}

export interface WorkspacesListResponse {
  workspaces: WorkspaceItem[];
}

// =============================================================================
// Filesystem Types
// =============================================================================

/** Provider status values for mount points */
export type ProviderStatus =
  | 'pending'
  | 'initializing'
  | 'ready'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'destroying'
  | 'destroyed'
  | 'error';

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  /** Mount point metadata (only set for CompositeFilesystem mount points) */
  mount?: {
    provider: string;
    icon?: string;
    displayName?: string;
    description?: string;
    status?: ProviderStatus;
    error?: string;
  };
}

export interface FileReadResponse {
  path: string;
  content: string;
  type: 'file' | 'directory';
  size?: number;
  mimeType?: string;
}

export interface FileListResponse {
  path: string;
  entries: FileEntry[];
}

export interface FileStatResponse {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
  mimeType?: string;
}

export interface WriteFileParams {
  workspaceId: string;
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  recursive?: boolean;
}

export interface WriteFileFromFileParams {
  workspaceId: string;
  path: string;
  file: File;
  recursive?: boolean;
}

// =============================================================================
// Search Types
// =============================================================================

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  lineRange?: {
    start: number;
    end: number;
  };
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  mode: 'bm25' | 'vector' | 'hybrid';
}

export interface SearchWorkspaceParams {
  workspaceId: string;
  query: string;
  topK?: number;
  mode?: 'bm25' | 'vector' | 'hybrid';
  minScore?: number;
}

// =============================================================================
// Skills Types
// =============================================================================

export type SkillSource =
  | { type: 'external'; packagePath: string }
  | { type: 'local'; projectPath: string }
  | { type: 'managed'; mastraPath: string };

/** Source info for skills installed via skills.sh */
export interface SkillsShSource {
  owner: string;
  repo: string;
}

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: unknown;
  metadata?: Record<string, unknown>;
  /** Path to the skill directory */
  path: string;
  /** Source info for skills installed via skills.sh (from .meta.json) */
  skillsShSource?: SkillsShSource;
}

export interface Skill extends SkillMetadata {
  path: string;
  instructions: string;
  source: SkillSource;
  references: string[];
  scripts: string[];
  assets: string[];
}

export interface ListSkillsResponse {
  skills: SkillMetadata[];
  isSkillsConfigured: boolean;
}

export interface SkillSearchResult {
  skillName: string;
  source: string;
  content: string;
  score: number;
  lineRange?: {
    start: number;
    end: number;
  };
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

export interface SearchSkillsResponse {
  results: SkillSearchResult[];
  query: string;
}

export interface ListReferencesResponse {
  skillName: string;
  references: string[];
}

export interface GetReferenceResponse {
  skillName: string;
  referencePath: string;
  content: string;
}

export interface SearchSkillsParams {
  workspaceId: string;
  query: string;
  topK?: number;
  minScore?: number;
  skillNames?: string[];
  includeReferences?: boolean;
}

// =============================================================================
// Mount Types
// =============================================================================

export interface MountInfo {
  path: string;
  provider: string;
  readOnly: boolean;
  displayName?: string;
  icon?: string;
  name?: string;
}

// =============================================================================
// skills.sh Types
// =============================================================================

export interface SkillsShSkill {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

export interface SkillsShSearchResponse {
  query: string;
  searchType: string;
  skills: SkillsShSkill[];
  count: number;
}

export interface SkillsShListResponse {
  skills: SkillsShSkill[];
  count: number;
  limit: number;
  offset: number;
}

// =============================================================================
// skills.sh Install Types
// =============================================================================

export interface SkillsShInstallParams {
  workspaceId: string;
  owner: string;
  repo: string;
  skillName: string;
  mount?: string;
}

export interface SkillsShInstallResponse {
  success: boolean;
  skillName: string;
  installedPath: string;
  filesWritten: number;
}

// =============================================================================
// skills.sh Remove Types
// =============================================================================

export interface SkillsShRemoveParams {
  workspaceId: string;
  skillName: string;
}

export interface SkillsShRemoveResponse {
  success: boolean;
  skillName: string;
  removedPath: string;
}

// =============================================================================
// skills.sh Update Types
// =============================================================================

export interface SkillsShUpdateParams {
  workspaceId: string;
  skillName?: string;
}

export interface SkillUpdateResult {
  skillName: string;
  success: boolean;
  filesWritten?: number;
  error?: string;
}

export interface SkillsShUpdateResponse {
  updated: SkillUpdateResult[];
}
