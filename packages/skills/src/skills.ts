import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import matter from 'gray-matter';
import z from 'zod';

import { BM25Index, type BM25Config, type TokenizeOptions } from './bm25';
import type {
  Skill,
  SkillMetadata,
  SkillSource,
  SkillsConfig,
  SkillSearchResult,
  SkillSearchOptions,
  MastraSkills,
} from './types';

// =========================================================================
// Validation Schemas (following Agent Skills spec)
// =========================================================================

/**
 * Skill name schema according to spec:
 * - 1-64 characters
 * - Lowercase letters, numbers, hyphens only
 * - Must not start or end with hyphen
 * - Must not contain consecutive hyphens
 */
const SkillNameSchema = z
  .string()
  .min(1, 'Skill name cannot be empty')
  .max(64, 'Skill name must be 64 characters or less')
  .regex(/^[a-z0-9-]+$/, 'Skill name must contain only lowercase letters, numbers, and hyphens')
  .refine(name => !name.startsWith('-') && !name.endsWith('-'), {
    message: 'Skill name must not start or end with a hyphen',
  })
  .refine(name => !name.includes('--'), {
    message: 'Skill name must not contain consecutive hyphens',
  })
  .describe('Skill name (1-64 chars, lowercase letters/numbers/hyphens only, must match directory name)');

/**
 * Skill description schema according to spec (1-1024 chars, non-empty)
 */
const SkillDescriptionSchema = z
  .string()
  .min(1, 'Skill description cannot be empty')
  .max(1024, 'Skill description must be 1024 characters or less')
  .refine(desc => desc.trim().length > 0, {
    message: 'Skill description cannot be only whitespace',
  })
  .describe('Description of what the skill does and when to use it (1-1024 characters)');

/**
 * Skill metadata schema
 */
const SkillMetadataSchema = z.object({
  name: SkillNameSchema,
  description: SkillDescriptionSchema,
  license: z.string().optional().describe('License for the skill (e.g., "Apache-2.0", "MIT")'),
  compatibility: z
    .string()
    .max(500, 'Compatibility field must be 500 characters or less')
    .optional()
    .describe('Environment requirements or compatibility notes (max 500 chars)'),
  metadata: z.record(z.string()).optional().describe('Arbitrary key-value metadata (e.g., author, version)'),
});

// =========================================================================
// Internal Types
// =========================================================================

interface InternalSkill extends Skill {
  /** Content for BM25 indexing (instructions + all references) */
  indexableContent: string;
}

// =========================================================================
// Skills Class
// =========================================================================

/**
 * Configuration for BM25 search
 */
export interface SkillsBM25Config {
  /** BM25 algorithm parameters */
  bm25?: BM25Config;
  /** Tokenization options */
  tokenize?: TokenizeOptions;
}

/**
 * Skills - manages discovery, parsing, and search of skills following the Agent Skills spec.
 *
 * @example
 * ```typescript
 * const skills = new Skills({
 *   id: 'my-skills',
 *   paths: ['./skills', 'node_modules/@company/skills'],
 * });
 *
 * // List all discovered skills
 * const allSkills = skills.list();
 *
 * // Get a specific skill
 * const skill = skills.get('brand-guidelines');
 *
 * // Search across all skills
 * const results = skills.search('brand colors');
 *
 * // Read a reference file
 * const content = skills.getReference('brand-guidelines', 'colors.md');
 * ```
 */
export class Skills implements MastraSkills {
  /** Unique identifier for this skills instance */
  readonly id: string;

  /** Configured paths to search for skills */
  readonly paths: string[];

  /** Whether to validate skills on load */
  readonly validateOnLoad: boolean;

  /** Map of skill name -> full skill data */
  #skills: Map<string, InternalSkill> = new Map();

  /** BM25 index for searching */
  #bm25Index: BM25Index;

  constructor(config: SkillsConfig, bm25Config?: SkillsBM25Config) {
    this.id = config.id;
    this.paths = Array.isArray(config.paths) ? config.paths : [config.paths];
    this.validateOnLoad = config.validateOnLoad ?? true;

    // Initialize BM25 index
    this.#bm25Index = new BM25Index(bm25Config?.bm25, bm25Config?.tokenize);

    // Discover skills at construction time
    this.refresh();
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * List all discovered skills (metadata only)
   */
  list(): SkillMetadata[] {
    return Array.from(this.#skills.values()).map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
      compatibility: skill.compatibility,
      metadata: skill.metadata,
    }));
  }

  /**
   * Get a specific skill by name (full content)
   */
  get(name: string): Skill | undefined {
    const skill = this.#skills.get(name);
    if (!skill) return undefined;

    // Return without internal indexableContent field
    const { indexableContent: _, ...skillData } = skill;
    return skillData;
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.#skills.has(name);
  }

  /**
   * Search across all skills content using BM25
   */
  search(query: string, options: SkillSearchOptions = {}): SkillSearchResult[] {
    const { topK = 5, minScore, skillNames, includeReferences = true } = options;

    // Get more results than needed to filter
    const expandedTopK = skillNames ? topK * 3 : topK;
    const bm25Results = this.#bm25Index.search(query, expandedTopK, minScore);

    const results: SkillSearchResult[] = [];

    for (const result of bm25Results) {
      const metadata = result.metadata as { skillName: string; source: string } | undefined;
      if (!metadata) continue;

      // Filter by skill names if specified
      if (skillNames && !skillNames.includes(metadata.skillName)) {
        continue;
      }

      // Filter out references if not included
      if (!includeReferences && metadata.source !== 'SKILL.md') {
        continue;
      }

      results.push({
        skillName: metadata.skillName,
        source: metadata.source,
        content: result.content,
        score: result.score,
      });

      if (results.length >= topK) break;
    }

    return results;
  }

  /**
   * Get reference file content from a skill
   */
  getReference(skillName: string, referencePath: string): string | undefined {
    const skill = this.#skills.get(skillName);
    if (!skill) return undefined;

    const refFilePath = join(skill.path, 'references', referencePath);

    if (!existsSync(refFilePath)) {
      return undefined;
    }

    try {
      return readFileSync(refFilePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * Get all reference file paths for a skill
   */
  getReferences(skillName: string): string[] {
    const skill = this.#skills.get(skillName);
    return skill?.references ?? [];
  }

  /**
   * Refresh skills from disk (re-scan directories)
   */
  refresh(): void {
    this.#skills.clear();
    this.#bm25Index.clear();

    for (const skillsPath of this.paths) {
      const resolvedPath = resolve(skillsPath);
      const source = this.#determineSource(resolvedPath);

      this.#discoverSkillsInPath(resolvedPath, source);
    }
  }

  /**
   * Get the number of discovered skills
   */
  get size(): number {
    return this.#skills.size;
  }

  /**
   * Get all skill names
   */
  get skillNames(): string[] {
    return Array.from(this.#skills.keys());
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Determine the source type based on the path
   */
  #determineSource(skillsPath: string): SkillSource {
    if (skillsPath.includes('node_modules')) {
      return { type: 'external', packagePath: skillsPath };
    }
    if (skillsPath.includes('.mastra/skills')) {
      return { type: 'managed', mastraPath: skillsPath };
    }
    return { type: 'local', projectPath: skillsPath };
  }

  /**
   * Discover skills in a single path
   */
  #discoverSkillsInPath(skillsPath: string, source: SkillSource): void {
    if (!existsSync(skillsPath)) {
      return;
    }

    try {
      const entries = readdirSync(skillsPath);

      for (const entry of entries) {
        const entryPath = join(skillsPath, entry);
        const stat = statSync(entryPath);

        if (stat.isDirectory()) {
          const skillFilePath = join(entryPath, 'SKILL.md');

          if (existsSync(skillFilePath)) {
            try {
              const skill = this.#parseSkillFile(skillFilePath, entry, source);

              // Check for duplicate names
              if (this.#skills.has(skill.name)) {
                console.warn(`[Skills] Duplicate skill name "${skill.name}" found in ${skillFilePath}. Last one wins.`);
              }

              this.#skills.set(skill.name, skill);

              // Index the skill content for search
              this.#indexSkill(skill);
            } catch (error) {
              if (error instanceof Error) {
                console.error(`[Skills] Failed to load skill from ${skillFilePath}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[Skills] Failed to scan skills directory ${skillsPath}:`, error.message);
      }
    }
  }

  /**
   * Parse a SKILL.md file
   */
  #parseSkillFile(filePath: string, dirName: string, source: SkillSource): InternalSkill {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const frontmatter = parsed.data;
    const body = parsed.content.trim();

    // Extract required fields
    const metadata: SkillMetadata = {
      name: frontmatter.name,
      description: frontmatter.description,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
      metadata: frontmatter.metadata,
    };

    // Validate if enabled
    if (this.validateOnLoad) {
      const validation = this.#validateSkillMetadata(metadata, dirName);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata in ${filePath}:\n${validation.errors.join('\n')}`);
      }
    }

    const skillPath = filePath.substring(0, filePath.lastIndexOf('/'));

    // Discover reference files
    const references = this.#discoverReferences(skillPath);

    // Build indexable content (instructions + references)
    const indexableContent = this.#buildIndexableContent(body, skillPath, references);

    return {
      ...metadata,
      path: skillPath,
      instructions: body,
      source,
      references,
      indexableContent,
    };
  }

  /**
   * Validate skill metadata
   */
  #validateSkillMetadata(metadata: SkillMetadata, dirName: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate against schema
    const result = SkillMetadataSchema.safeParse(metadata);
    if (!result.success) {
      errors.push(...result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`));
    }

    // Validate name matches directory
    if (metadata.name !== dirName) {
      errors.push(`Skill name "${metadata.name}" must match directory name "${dirName}"`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Discover reference files in a skill directory
   */
  #discoverReferences(skillPath: string): string[] {
    const refsPath = join(skillPath, 'references');
    const references: string[] = [];

    if (!existsSync(refsPath)) {
      return references;
    }

    try {
      this.#walkDirectory(refsPath, (filePath: string) => {
        // Get relative path from references directory
        const relativePath = filePath.substring(refsPath.length + 1);
        references.push(relativePath);
      });
    } catch {
      // Failed to read references directory
    }

    return references;
  }

  /**
   * Walk a directory recursively and call callback for each file
   */
  #walkDirectory(dirPath: string, callback: (filePath: string) => void): void {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        this.#walkDirectory(entryPath, callback);
      } else {
        callback(entryPath);
      }
    }
  }

  /**
   * Build indexable content from instructions and references
   */
  #buildIndexableContent(instructions: string, skillPath: string, references: string[]): string {
    const parts = [instructions];

    for (const refPath of references) {
      const fullPath = join(skillPath, 'references', refPath);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        parts.push(content);
      } catch {
        // Skip files that can't be read
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Index a skill for BM25 search
   */
  #indexSkill(skill: InternalSkill): void {
    // Index the main skill instructions
    this.#bm25Index.add(`${skill.name}:SKILL.md`, skill.instructions, {
      skillName: skill.name,
      source: 'SKILL.md',
    });

    // Index each reference file separately
    for (const refPath of skill.references) {
      const fullPath = join(skill.path, 'references', refPath);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        this.#bm25Index.add(`${skill.name}:${refPath}`, content, {
          skillName: skill.name,
          source: `references/${refPath}`,
        });
      } catch {
        // Skip files that can't be read
      }
    }
  }
}
