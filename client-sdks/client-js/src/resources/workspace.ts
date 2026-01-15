import type {
  ClientOptions,
  WorkspaceInfoResponse,
  WorkspaceFsReadResponse,
  WorkspaceFsWriteResponse,
  WorkspaceFsListResponse,
  WorkspaceFsDeleteResponse,
  WorkspaceFsMkdirResponse,
  WorkspaceFsStatResponse,
  WorkspaceSearchParams,
  WorkspaceSearchResponse,
  WorkspaceIndexParams,
  WorkspaceIndexResponse,
  WorkspaceUnindexResponse,
  ListSkillsResponse,
  Skill,
  SearchSkillsParams,
  SearchSkillsResponse,
  ListSkillReferencesResponse,
  GetSkillReferenceResponse,
} from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific skill via the workspace API
 */
export class WorkspaceSkillResource extends BaseResource {
  constructor(
    options: ClientOptions,
    private skillName: string,
  ) {
    super(options);
  }

  /**
   * Gets the full details of this skill including instructions
   * @returns Promise containing skill details
   */
  details(): Promise<Skill> {
    return this.request(`/api/workspace/skills/${encodeURIComponent(this.skillName)}`);
  }

  /**
   * Lists all reference file paths for this skill
   * @returns Promise containing list of reference paths
   */
  listReferences(): Promise<ListSkillReferencesResponse> {
    return this.request(`/api/workspace/skills/${encodeURIComponent(this.skillName)}/references`);
  }

  /**
   * Gets the content of a specific reference file
   * @param referencePath - Path to the reference file
   * @returns Promise containing reference content
   */
  getReference(referencePath: string): Promise<GetSkillReferenceResponse> {
    return this.request(
      `/api/workspace/skills/${encodeURIComponent(this.skillName)}/references/${encodeURIComponent(referencePath)}`,
    );
  }
}

/**
 * Resource for interacting with the workspace API
 *
 * The workspace provides:
 * - Filesystem operations (read, write, list, delete, mkdir, stat)
 * - Search operations (search, index, unindex)
 * - Skills operations (list, get, search, references)
 */
export class Workspace extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  // ==========================================================================
  // Workspace Info
  // ==========================================================================

  /**
   * Gets information about the configured workspace and its capabilities
   * @returns Promise containing workspace info
   */
  info(): Promise<WorkspaceInfoResponse> {
    return this.request('/api/workspace');
  }

  // ==========================================================================
  // Filesystem Operations
  // ==========================================================================

  /**
   * Reads a file from the workspace filesystem
   * @param path - Path to the file to read
   * @param encoding - Optional encoding (default: utf-8)
   * @returns Promise containing file content and metadata
   */
  readFile(path: string, encoding?: string): Promise<WorkspaceFsReadResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    if (encoding) {
      searchParams.set('encoding', encoding);
    }
    return this.request(`/api/workspace/fs/read?${searchParams.toString()}`);
  }

  /**
   * Writes content to a file in the workspace filesystem
   * @param path - Path to write to
   * @param content - Content to write
   * @param recursive - Whether to create parent directories if needed
   * @returns Promise containing success status
   */
  writeFile(path: string, content: string, recursive?: boolean): Promise<WorkspaceFsWriteResponse> {
    return this.request('/api/workspace/fs/write', {
      method: 'POST',
      body: { path, content, recursive },
    });
  }

  /**
   * Lists files and directories in the workspace
   * @param path - Path to the directory to list
   * @param recursive - Whether to include subdirectories
   * @returns Promise containing directory listing
   */
  listFiles(path: string, recursive?: boolean): Promise<WorkspaceFsListResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    if (recursive !== undefined) {
      searchParams.set('recursive', String(recursive));
    }
    return this.request(`/api/workspace/fs/list?${searchParams.toString()}`);
  }

  /**
   * Deletes a file or directory from the workspace
   * @param path - Path to delete
   * @param options - Delete options
   * @returns Promise containing success status
   */
  delete(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<WorkspaceFsDeleteResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    if (options?.recursive !== undefined) {
      searchParams.set('recursive', String(options.recursive));
    }
    if (options?.force !== undefined) {
      searchParams.set('force', String(options.force));
    }
    return this.request(`/api/workspace/fs/delete?${searchParams.toString()}`, {
      method: 'DELETE',
    });
  }

  /**
   * Creates a directory in the workspace
   * @param path - Directory path to create
   * @param recursive - Whether to create parent directories if needed
   * @returns Promise containing success status
   */
  mkdir(path: string, recursive?: boolean): Promise<WorkspaceFsMkdirResponse> {
    return this.request('/api/workspace/fs/mkdir', {
      method: 'POST',
      body: { path, recursive },
    });
  }

  /**
   * Gets information about a file or directory
   * @param path - Path to get info about
   * @returns Promise containing file/directory stats
   */
  stat(path: string): Promise<WorkspaceFsStatResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    return this.request(`/api/workspace/fs/stat?${searchParams.toString()}`);
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Searches across indexed workspace content
   * @param params - Search parameters
   * @returns Promise containing search results
   */
  search(params: WorkspaceSearchParams): Promise<WorkspaceSearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('query', params.query);
    if (params.topK !== undefined) {
      searchParams.set('topK', String(params.topK));
    }
    if (params.mode) {
      searchParams.set('mode', params.mode);
    }
    if (params.minScore !== undefined) {
      searchParams.set('minScore', String(params.minScore));
    }
    return this.request(`/api/workspace/search?${searchParams.toString()}`);
  }

  /**
   * Indexes content for search
   * @param params - Index parameters including path and content
   * @returns Promise containing success status
   */
  index(params: WorkspaceIndexParams): Promise<WorkspaceIndexResponse> {
    return this.request('/api/workspace/index', {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Removes content from the search index
   * @param path - Path to unindex
   * @returns Promise containing success status
   */
  unindex(path: string): Promise<WorkspaceUnindexResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    return this.request(`/api/workspace/unindex?${searchParams.toString()}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Skills Operations
  // ==========================================================================

  /**
   * Lists all discovered skills
   * @returns Promise containing list of skills with metadata
   */
  listSkills(): Promise<ListSkillsResponse> {
    return this.request('/api/workspace/skills');
  }

  /**
   * Searches across all skills content
   * @param params - Search parameters
   * @returns Promise containing search results
   */
  searchSkills(params: SearchSkillsParams): Promise<SearchSkillsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('query', params.query);
    if (params.topK !== undefined) {
      searchParams.set('topK', String(params.topK));
    }
    if (params.minScore !== undefined) {
      searchParams.set('minScore', String(params.minScore));
    }
    if (params.skillNames && params.skillNames.length > 0) {
      searchParams.set('skillNames', params.skillNames.join(','));
    }
    if (params.includeReferences !== undefined) {
      searchParams.set('includeReferences', String(params.includeReferences));
    }
    return this.request(`/api/workspace/skills/search?${searchParams.toString()}`);
  }

  /**
   * Gets a skill instance for further operations
   * @param skillName - Skill name identifier
   * @returns WorkspaceSkillResource instance
   */
  getSkill(skillName: string): WorkspaceSkillResource {
    return new WorkspaceSkillResource(this.options, skillName);
  }
}
