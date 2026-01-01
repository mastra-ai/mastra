/**
 * Types for the Skills primitive following the Agent Skills specification.
 * @see https://github.com/anthropics/skills
 */

import type { BaseSearchResult, BaseSearchOptions, SearchMode, ContentSource } from '../artifacts';

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
  /** Absolute path to skill directory */
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
 * Search mode for skill queries (alias for shared SearchMode)
 */
export type SkillSearchMode = SearchMode;

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

/**
 * Base interface for Skills instances that can be registered with Mastra.
 * The actual Skills class in @mastra/skills implements this interface.
 *
 * Skills manages discovery, parsing, and search of skills following the Agent Skills spec.
 *
 * CRUD operations (create, update, delete) only work for writable sources:
 * - 'local' (./src/skills) - read-write
 * - 'managed' (.mastra/skills) - read-write
 * - 'external' (node_modules) - read-only
 */
export interface MastraSkills {
  /** Unique identifier for this skills instance */
  id: string;

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * List all discovered skills (metadata only)
   */
  list(): SkillMetadata[];

  /**
   * Get a specific skill by name (full content)
   */
  get(name: string): Skill | undefined;

  /**
   * Check if a skill exists
   */
  has(name: string): boolean;

  /**
   * Search across all skills content.
   */
  search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>;

  // ============================================================================
  // CRUD Operations (for writable sources only)
  // ============================================================================

  /**
   * Create a new skill.
   * Creates a skill directory with SKILL.md and optional reference/script/asset files.
   *
   * @param input - Skill creation input
   * @throws Error if no writable path is available or skill already exists
   */
  create(input: CreateSkillInput): Promise<Skill>;

  /**
   * Update an existing skill.
   * Only works for skills in writable paths (local or managed).
   *
   * @param name - Name of the skill to update
   * @param input - Update input (partial metadata and/or instructions)
   * @throws Error if skill doesn't exist or is in a read-only path
   */
  update(name: string, input: UpdateSkillInput): Promise<Skill>;

  /**
   * Delete a skill.
   * Only works for skills in writable paths (local or managed).
   *
   * @param name - Name of the skill to delete
   * @throws Error if skill doesn't exist or is in a read-only path
   */
  delete(name: string): Promise<void>;

  // ============================================================================
  // Reference Operations
  // ============================================================================

  /**
   * Get reference file content from a skill
   */
  getReference(skillName: string, referencePath: string): string | undefined;

  /**
   * Get all reference file paths for a skill
   */
  getReferences(skillName: string): string[];

  // ============================================================================
  // Script Operations
  // ============================================================================

  /**
   * Get script file content from a skill
   */
  getScript(skillName: string, scriptPath: string): string | undefined;

  /**
   * Get all script file paths for a skill
   */
  getScripts(skillName: string): string[];

  // ============================================================================
  // Asset Operations
  // ============================================================================

  /**
   * Get asset file content from a skill (returns Buffer for binary files)
   */
  getAsset(skillName: string, assetPath: string): Buffer | undefined;

  /**
   * Get all asset file paths for a skill
   */
  getAssets(skillName: string): string[];

  // ============================================================================
  // Refresh
  // ============================================================================

  /**
   * Refresh skills from disk (re-scan directories)
   */
  refresh(): void;
}
