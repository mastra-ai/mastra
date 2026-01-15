/**
 * Types for Skills following the Agent Skills specification.
 * Skills are SKILL.md files discovered from workspace skillsPaths.
 *
 * @see https://github.com/anthropics/skills
 */

import type { BaseSearchResult, BaseSearchOptions, ContentSource } from '../artifacts';

/**
 * Skill source types indicating where the skill comes from and its access level.
 * Alias for the shared ContentSource type.
 */
export type SkillSource = ContentSource;

/**
 * Supported skill format types for system message injection
 */
export type SkillFormat = 'xml' | 'json' | 'markdown';

/**
 * Skill metadata from YAML frontmatter (following Agent Skills spec)
 */
export interface SkillMetadata {
  /** Skill name (1-64 chars, lowercase, hyphens only) */
  name: string;
  /** Description of what the skill does and when to use it (1-1024 chars) */
  description: string;
  /** Optional license */
  license?: string;
  /** Optional compatibility requirements */
  compatibility?: string;
  /** Optional arbitrary metadata */
  metadata?: Record<string, string>;
  /**
   * Pre-approved tools the skill may use (experimental).
   * In YAML: space-delimited string. Parsed to array.
   * @experimental Support may vary between agent implementations.
   */
  allowedTools?: string[];
}

/**
 * Full skill with parsed instructions and path info
 */
export interface Skill extends SkillMetadata {
  /** Path to skill directory (relative to workspace root) */
  path: string;
  /** Markdown body from SKILL.md */
  instructions: string;
  /** Source of the skill (external package, local project, or managed) */
  source: SkillSource;
  /** List of reference file paths (relative to references/ directory) */
  references: string[];
  /** List of script file paths (relative to scripts/ directory) */
  scripts: string[];
  /** List of asset file paths (relative to assets/ directory) */
  assets: string[];
}

/**
 * Search result when searching across skills
 */
export interface SkillSearchResult extends BaseSearchResult {
  /** Skill name */
  skillName: string;
  /** Source file (SKILL.md or reference path) */
  source: string;
}

/**
 * Options for searching skills
 */
export interface SkillSearchOptions extends BaseSearchOptions {
  /** Only search within specific skill names */
  skillNames?: string[];
  /** Include reference files in search (default: true) */
  includeReferences?: boolean;
}

/**
 * Options for creating a skill
 */
export interface CreateSkillInput {
  /** Skill metadata (name, description, etc.) */
  metadata: SkillMetadata;
  /** Markdown instructions (body of SKILL.md) */
  instructions: string;
  /** Optional reference files to include */
  references?: Array<{ path: string; content: string }>;
  /** Optional script files to include */
  scripts?: Array<{ path: string; content: string }>;
  /** Optional asset files to include */
  assets?: Array<{ path: string; content: Buffer | string }>;
}

/**
 * Options for updating a skill
 */
export interface UpdateSkillInput {
  /** Updated metadata (partial - only provided fields are updated) */
  metadata?: Partial<SkillMetadata>;
  /** Updated instructions */
  instructions?: string;
}

// =============================================================================
// WorkspaceSkills Interface
// =============================================================================

/**
 * Interface for skills accessed via workspace.skills.
 * Provides discovery, search, and CRUD operations for skills in the workspace.
 *
 * Skills are SKILL.md files discovered from configured skillsPaths.
 * All operations are async because they use the workspace filesystem.
 *
 * @example
 * ```typescript
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './data' }),
 *   skillsPaths: ['/skills'],
 * });
 *
 * // List all skills
 * const skills = await workspace.skills.list();
 *
 * // Get a specific skill
 * const skill = await workspace.skills.get('brand-guidelines');
 *
 * // Search skills
 * const results = await workspace.skills.search('color palette');
 * ```
 */
export interface WorkspaceSkills {
  // ===========================================================================
  // Discovery
  // ===========================================================================

  /**
   * List all discovered skills (metadata only)
   */
  list(): Promise<SkillMetadata[]>;

  /**
   * Get a specific skill by name (full content)
   */
  get(name: string): Promise<Skill | null>;

  /**
   * Check if a skill exists
   */
  has(name: string): Promise<boolean>;

  /**
   * Refresh skills from filesystem (re-scan skillsPaths)
   */
  refresh(): Promise<void>;

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search across all skills content.
   * Uses workspace's search engine (BM25, vector, or hybrid).
   */
  search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>;

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new skill.
   * Creates a skill directory with SKILL.md and optional reference/script/asset files.
   *
   * @param input - Skill creation input
   * @throws Error if skill already exists or validation fails
   */
  create(input: CreateSkillInput): Promise<Skill>;

  /**
   * Update an existing skill.
   *
   * @param name - Name of the skill to update
   * @param input - Update input (partial metadata and/or instructions)
   * @throws Error if skill doesn't exist
   */
  update(name: string, input: UpdateSkillInput): Promise<Skill>;

  /**
   * Delete a skill.
   *
   * @param name - Name of the skill to delete
   * @throws Error if skill doesn't exist
   */
  delete(name: string): Promise<void>;

  // ===========================================================================
  // Single-item Accessors
  // ===========================================================================

  /**
   * Get reference file content from a skill
   */
  getReference(skillName: string, referencePath: string): Promise<string | null>;

  /**
   * Get script file content from a skill
   */
  getScript(skillName: string, scriptPath: string): Promise<string | null>;

  /**
   * Get asset file content from a skill (returns Buffer for binary files)
   */
  getAsset(skillName: string, assetPath: string): Promise<Buffer | null>;

  // ===========================================================================
  // Listing Accessors
  // ===========================================================================

  /**
   * Get all reference file paths for a skill
   */
  listReferences(skillName: string): Promise<string[]>;

  /**
   * Get all script file paths for a skill
   */
  listScripts(skillName: string): Promise<string[]>;

  /**
   * Get all asset file paths for a skill
   */
  listAssets(skillName: string): Promise<string[]>;
}
