/**
 * Types for the Skills Registry API
 * Following the Agent Skills specification: https://agentskills.io
 */

/**
 * Skill metadata from the registry
 */
export interface RegistrySkill {
  /** Unique skill identifier (matches directory name) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what the skill does */
  description: string;
  /** Version following semver */
  version: string;
  /** Author or organization */
  author: string;
  /** License (e.g., "MIT", "Apache-2.0") */
  license: string;
  /** Repository URL */
  repository?: string;
  /** Homepage URL */
  homepage?: string;
  /** Tags for categorization */
  tags: string[];
  /** Category (e.g., "development", "writing", "data") */
  category: string;
  /** Download/install count */
  downloads?: number;
  /** Star/rating count */
  stars?: number;
  /** When the skill was created */
  createdAt: string;
  /** When the skill was last updated */
  updatedAt: string;
  /** NPM package name if published to npm */
  npmPackage?: string;
  /** GitHub repository path (owner/repo) */
  githubRepo?: string;
  /** Whether this is a featured skill */
  featured?: boolean;
  /** Compatibility information */
  compatibility?: {
    /** Minimum Mastra version */
    mastraVersion?: string;
    /** Required model capabilities */
    models?: string[];
    /** Required tools */
    tools?: string[];
  };
  /** Preview/example of the skill instructions */
  preview?: string;
}

/**
 * Paginated response for skill listings
 */
export interface PaginatedSkillsResponse {
  skills: RegistrySkill[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Search parameters for skills
 */
export interface SkillSearchParams {
  /** Search query string */
  query?: string;
  /** Filter by category */
  category?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by author */
  author?: string;
  /** Sort field */
  sortBy?: 'name' | 'downloads' | 'stars' | 'createdAt' | 'updatedAt';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Only show featured skills */
  featured?: boolean;
}

/**
 * Category with skill counts
 */
export interface Category {
  name: string;
  displayName: string;
  description: string;
  skillCount: number;
}
