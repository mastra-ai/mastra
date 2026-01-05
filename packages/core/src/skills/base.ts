import { ContentStorage } from '../artifacts';
import type { ListContentOptions } from '../artifacts';
import { RegisteredLogger } from '../logger';

import type { Skill, SkillMetadata } from './types';

/**
 * Options for listing skills.
 * Extends the shared ListContentOptions.
 */
export interface ListSkillsOptions extends ListContentOptions {}

/**
 * Options for creating a skill
 */
export interface CreateSkillOptions {
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
export interface UpdateSkillOptions {
  /** Updated metadata (partial - only provided fields are updated) */
  metadata?: Partial<SkillMetadata>;
  /** Updated instructions */
  instructions?: string;
}

/**
 * Abstract base class for skills storage backends.
 * Implementations handle the actual discovery and persistence of skills.
 *
 * Storage backends support multiple paths (external packages, local project, managed).
 * For filesystem storage, each path is scanned for skill directories.
 *
 * CRUD operations (create, update, delete) only work for writable sources:
 * - 'local' (./src/skills) - read-write
 * - 'managed' (.mastra/skills) - read-write
 * - 'external' (node_modules) - read-only
 *
 * This class lives in @mastra/core so that storage adapters
 * can be built in separate packages.
 */
export abstract class SkillsStorage extends ContentStorage {
  constructor({ paths }: { paths: string | string[] }) {
    super({ component: RegisteredLogger.SKILLS, paths });
  }

  // ============================================================================
  // Skill Discovery (Read)
  // ============================================================================

  /**
   * Discover and list all skills from configured paths.
   * Returns metadata only (not full content).
   */
  abstract listSkills(options?: ListSkillsOptions): Promise<SkillMetadata[]>;

  /**
   * Get a specific skill by name (full content including instructions).
   */
  abstract getSkill(name: string): Promise<Skill | null>;

  /**
   * Check if a skill exists.
   */
  abstract hasSkill(name: string): Promise<boolean>;

  // ============================================================================
  // Skill CRUD (Create, Update, Delete)
  // ============================================================================

  /**
   * Create a new skill.
   * Creates a skill directory with SKILL.md and optional reference/script/asset files.
   *
   * @param options - Skill creation options
   * @param targetPath - Optional target path (must be a writable path). Defaults to first managed path.
   * @throws Error if no writable path is available or skill already exists
   */
  abstract createSkill(options: CreateSkillOptions, targetPath?: string): Promise<Skill>;

  /**
   * Update an existing skill.
   * Only works for skills in writable paths (local or managed).
   *
   * @param name - Name of the skill to update
   * @param options - Update options (partial metadata and/or instructions)
   * @throws Error if skill doesn't exist or is in a read-only path
   */
  abstract updateSkill(name: string, options: UpdateSkillOptions): Promise<Skill>;

  /**
   * Delete a skill.
   * Only works for skills in writable paths (local or managed).
   *
   * @param name - Name of the skill to delete
   * @throws Error if skill doesn't exist or is in a read-only path
   */
  abstract deleteSkill(name: string): Promise<void>;

  // ============================================================================
  // Reference Operations
  // ============================================================================

  /**
   * Get reference file content from a skill.
   */
  abstract getReference(skillName: string, referencePath: string): Promise<string | null>;

  /**
   * List all reference file paths for a skill.
   */
  abstract listReferences(skillName: string): Promise<string[]>;

  /**
   * Add or update a reference file in a skill.
   * Only works for skills in writable paths.
   *
   * @param skillName - Name of the skill
   * @param referencePath - Path relative to references/ directory
   * @param content - File content
   * @throws Error if skill is in a read-only path
   */
  abstract setReference(skillName: string, referencePath: string, content: string): Promise<void>;

  /**
   * Delete a reference file from a skill.
   * Only works for skills in writable paths.
   *
   * @param skillName - Name of the skill
   * @param referencePath - Path relative to references/ directory
   * @throws Error if skill is in a read-only path
   */
  abstract deleteReference(skillName: string, referencePath: string): Promise<void>;

  // ============================================================================
  // Script Operations
  // ============================================================================

  /**
   * Get script file content from a skill.
   */
  abstract getScript(skillName: string, scriptPath: string): Promise<string | null>;

  /**
   * List all script file paths for a skill.
   */
  abstract listScripts(skillName: string): Promise<string[]>;

  /**
   * Add or update a script file in a skill.
   * Only works for skills in writable paths.
   */
  abstract setScript(skillName: string, scriptPath: string, content: string): Promise<void>;

  /**
   * Delete a script file from a skill.
   * Only works for skills in writable paths.
   */
  abstract deleteScript(skillName: string, scriptPath: string): Promise<void>;

  // ============================================================================
  // Asset Operations
  // ============================================================================

  /**
   * Get asset file content from a skill.
   */
  abstract getAsset(skillName: string, assetPath: string): Promise<Buffer | null>;

  /**
   * List all asset file paths for a skill.
   */
  abstract listAssets(skillName: string): Promise<string[]>;

  /**
   * Add or update an asset file in a skill.
   * Only works for skills in writable paths.
   */
  abstract setAsset(skillName: string, assetPath: string, content: Buffer | string): Promise<void>;

  /**
   * Delete an asset file from a skill.
   * Only works for skills in writable paths.
   */
  abstract deleteAsset(skillName: string, assetPath: string): Promise<void>;
}
