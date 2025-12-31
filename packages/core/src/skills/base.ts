import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';

import type { Skill, SkillMetadata } from './types';

/**
 * Options for listing skills
 */
export interface ListSkillsOptions {
  /** Only include skills from specific source types */
  sourceTypes?: Array<'external' | 'local' | 'managed'>;
}

/**
 * Abstract base class for skills storage backends.
 * Implementations handle the actual discovery and persistence of skills.
 *
 * Storage backends support multiple paths (external packages, local project, managed).
 * For filesystem storage, each path is scanned for skill directories.
 *
 * This class lives in @mastra/core so that storage adapters
 * can be built in separate packages.
 */
export abstract class SkillsStorage extends MastraBase {
  /**
   * Paths to search for skills.
   */
  paths: string[];

  constructor({ paths }: { paths: string | string[] }) {
    const pathsArray = Array.isArray(paths) ? paths : [paths];
    super({ component: RegisteredLogger.SKILLS, name: pathsArray.join(', ') });
    this.paths = pathsArray;
  }

  /**
   * Initialize the storage backend.
   * Called once before first use.
   */
  async init(): Promise<void> {
    // Default no-op - adapters override if they need initialization
  }

  // ============================================================================
  // Skill Discovery
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

  // ============================================================================
  // Refresh
  // ============================================================================

  /**
   * Refresh the skill cache by re-scanning all paths.
   */
  abstract refresh(): Promise<void>;
}
