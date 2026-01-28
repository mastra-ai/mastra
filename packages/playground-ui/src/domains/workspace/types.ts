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

export interface WorkspaceInfo {
  isWorkspaceConfigured: boolean;
  id?: string;
  name?: string;
  status?: string;
  capabilities?: WorkspaceCapabilities;
  safety?: WorkspaceSafety;
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

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
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
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  recursive?: boolean;
  workspaceId?: string;
}

export interface WriteFileFromFileParams {
  path: string;
  file: File;
  recursive?: boolean;
  workspaceId?: string;
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
  query: string;
  topK?: number;
  mode?: 'bm25' | 'vector' | 'hybrid';
  minScore?: number;
  workspaceId?: string;
}

// =============================================================================
// Skills Types
// =============================================================================

export type SkillSource =
  | { type: 'external'; packagePath: string }
  | { type: 'local'; projectPath: string }
  | { type: 'managed'; mastraPath: string };

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
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
  query: string;
  topK?: number;
  minScore?: number;
  skillNames?: string[];
  includeReferences?: boolean;
  workspaceId?: string;
}
