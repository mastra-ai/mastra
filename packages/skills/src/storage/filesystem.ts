import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { getSourceForPath, isWritableSource } from '@mastra/core/artifacts';
import { SkillsStorage } from '@mastra/core/skills';
import type {
  ListSkillsOptions,
  CreateSkillOptions,
  UpdateSkillOptions,
  Skill,
  SkillMetadata,
  SkillSource,
} from '@mastra/core/skills';
import matter from 'gray-matter';
import z from 'zod';

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
// Types
// =========================================================================

export interface FilesystemStorageOptions {
  /** Path or paths to directories containing skills */
  paths: string | string[];
  /** Validate skills on load (default: true) */
  validateOnLoad?: boolean;
}

// =========================================================================
// FilesystemStorage
// =========================================================================

/**
 * Filesystem-based skills storage.
 * Discovers and loads skills from the filesystem following the Agent Skills spec.
 *
 * Each skill is a directory containing a SKILL.md file with YAML frontmatter.
 *
 * @example
 * ```typescript
 * const storage = new FilesystemStorage({
 *   paths: ['./skills', 'node_modules/@company/skills'],
 * });
 *
 * const skills = await storage.listSkills();
 * const skill = await storage.getSkill('brand-guidelines');
 * ```
 */
export class FilesystemStorage extends SkillsStorage {
  /** Whether to validate skills on load */
  readonly validateOnLoad: boolean;

  /** Cache of discovered skills */
  #skillsCache: Map<string, Skill> = new Map();

  /** Whether the cache has been initialized */
  #initialized: boolean = false;

  constructor(options: FilesystemStorageOptions) {
    super({ paths: options.paths });
    this.validateOnLoad = options.validateOnLoad ?? true;
  }

  /**
   * Initialize the storage by discovering skills.
   */
  override async init(): Promise<void> {
    await this.refresh();
  }

  // ============================================================================
  // Skill Discovery
  // ============================================================================

  async listSkills(options?: ListSkillsOptions): Promise<SkillMetadata[]> {
    await this.#ensureInitialized();

    let skills = Array.from(this.#skillsCache.values());

    // Filter by source types if specified
    if (options?.sourceTypes && options.sourceTypes.length > 0) {
      skills = skills.filter(skill => options.sourceTypes!.includes(skill.source.type));
    }

    return skills.map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
      compatibility: skill.compatibility,
      metadata: skill.metadata,
    }));
  }

  async getSkill(name: string): Promise<Skill | null> {
    await this.#ensureInitialized();
    return this.#skillsCache.get(name) ?? null;
  }

  async hasSkill(name: string): Promise<boolean> {
    await this.#ensureInitialized();
    return this.#skillsCache.has(name);
  }

  // ============================================================================
  // Reference Operations
  // ============================================================================

  async getReference(skillName: string, referencePath: string): Promise<string | null> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) return null;

    const refFilePath = join(skill.path, 'references', referencePath);

    if (!existsSync(refFilePath)) {
      return null;
    }

    try {
      return readFileSync(refFilePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async listReferences(skillName: string): Promise<string[]> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    return skill?.references ?? [];
  }

  async setReference(skillName: string, referencePath: string, content: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    this.#ensureWritable(skill);

    const refFilePath = join(skill.path, 'references', referencePath);
    const refDir = dirname(refFilePath);

    // Create directory if it doesn't exist
    if (!existsSync(refDir)) {
      mkdirSync(refDir, { recursive: true });
    }

    writeFileSync(refFilePath, content, 'utf-8');

    // Update cache
    if (!skill.references.includes(referencePath)) {
      skill.references.push(referencePath);
    }
  }

  async deleteReference(skillName: string, referencePath: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    this.#ensureWritable(skill);

    const refFilePath = join(skill.path, 'references', referencePath);

    if (existsSync(refFilePath)) {
      rmSync(refFilePath);
    }

    // Update cache
    const index = skill.references.indexOf(referencePath);
    if (index !== -1) {
      skill.references.splice(index, 1);
    }
  }

  // ============================================================================
  // Script Operations
  // ============================================================================

  async getScript(skillName: string, scriptPath: string): Promise<string | null> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) return null;

    const scriptFilePath = join(skill.path, 'scripts', scriptPath);

    if (!existsSync(scriptFilePath)) {
      return null;
    }

    try {
      return readFileSync(scriptFilePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async listScripts(skillName: string): Promise<string[]> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    return skill?.scripts ?? [];
  }

  async setScript(skillName: string, scriptPath: string, content: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    this.#ensureWritable(skill);

    const scriptFilePath = join(skill.path, 'scripts', scriptPath);
    const scriptDir = dirname(scriptFilePath);

    if (!existsSync(scriptDir)) {
      mkdirSync(scriptDir, { recursive: true });
    }

    writeFileSync(scriptFilePath, content, 'utf-8');

    if (!skill.scripts.includes(scriptPath)) {
      skill.scripts.push(scriptPath);
    }
  }

  async deleteScript(skillName: string, scriptPath: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    this.#ensureWritable(skill);

    const scriptFilePath = join(skill.path, 'scripts', scriptPath);

    if (existsSync(scriptFilePath)) {
      rmSync(scriptFilePath);
    }

    const index = skill.scripts.indexOf(scriptPath);
    if (index !== -1) {
      skill.scripts.splice(index, 1);
    }
  }

  // ============================================================================
  // Asset Operations
  // ============================================================================

  async getAsset(skillName: string, assetPath: string): Promise<Buffer | null> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) return null;

    const assetFilePath = join(skill.path, 'assets', assetPath);

    if (!existsSync(assetFilePath)) {
      return null;
    }

    try {
      return readFileSync(assetFilePath);
    } catch {
      return null;
    }
  }

  async listAssets(skillName: string): Promise<string[]> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    return skill?.assets ?? [];
  }

  async setAsset(skillName: string, assetPath: string, content: Buffer | string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    this.#ensureWritable(skill);

    const assetFilePath = join(skill.path, 'assets', assetPath);
    const assetDir = dirname(assetFilePath);

    if (!existsSync(assetDir)) {
      mkdirSync(assetDir, { recursive: true });
    }

    writeFileSync(assetFilePath, content);

    if (!skill.assets.includes(assetPath)) {
      skill.assets.push(assetPath);
    }
  }

  async deleteAsset(skillName: string, assetPath: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(skillName);
    if (!skill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    this.#ensureWritable(skill);

    const assetFilePath = join(skill.path, 'assets', assetPath);

    if (existsSync(assetFilePath)) {
      rmSync(assetFilePath);
    }

    const index = skill.assets.indexOf(assetPath);
    if (index !== -1) {
      skill.assets.splice(index, 1);
    }
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async createSkill(options: CreateSkillOptions, targetPath?: string): Promise<Skill> {
    await this.#ensureInitialized();

    const { metadata, instructions, references, scripts, assets } = options;

    // Check if skill already exists
    if (this.#skillsCache.has(metadata.name)) {
      throw new Error(`Skill "${metadata.name}" already exists`);
    }

    // Determine target path (must be writable)
    const writablePath = targetPath ?? this.#getFirstWritablePath();
    if (!writablePath) {
      throw new Error('No writable path available for creating skills');
    }

    // Validate the skill metadata
    if (this.validateOnLoad) {
      const validation = this.#validateSkillMetadata(metadata, metadata.name);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata:\n${validation.errors.join('\n')}`);
      }
    }

    // Create skill directory
    const skillDir = join(writablePath, metadata.name);
    if (existsSync(skillDir)) {
      throw new Error(`Directory "${skillDir}" already exists`);
    }
    mkdirSync(skillDir, { recursive: true });

    // Build SKILL.md content
    const skillMdContent = this.#buildSkillMd(metadata, instructions);
    writeFileSync(join(skillDir, 'SKILL.md'), skillMdContent, 'utf-8');

    // Create reference files
    const refPaths: string[] = [];
    if (references) {
      const refsDir = join(skillDir, 'references');
      mkdirSync(refsDir, { recursive: true });
      for (const ref of references) {
        const refPath = join(refsDir, ref.path);
        const refDir = dirname(refPath);
        if (!existsSync(refDir)) {
          mkdirSync(refDir, { recursive: true });
        }
        writeFileSync(refPath, ref.content, 'utf-8');
        refPaths.push(ref.path);
      }
    }

    // Create script files
    const scriptPaths: string[] = [];
    if (scripts) {
      const scriptsDir = join(skillDir, 'scripts');
      mkdirSync(scriptsDir, { recursive: true });
      for (const script of scripts) {
        const scriptPath = join(scriptsDir, script.path);
        const scriptDir = dirname(scriptPath);
        if (!existsSync(scriptDir)) {
          mkdirSync(scriptDir, { recursive: true });
        }
        writeFileSync(scriptPath, script.content, 'utf-8');
        scriptPaths.push(script.path);
      }
    }

    // Create asset files
    const assetPaths: string[] = [];
    if (assets) {
      const assetsDir = join(skillDir, 'assets');
      mkdirSync(assetsDir, { recursive: true });
      for (const asset of assets) {
        const assetPath = join(assetsDir, asset.path);
        const assetDir = dirname(assetPath);
        if (!existsSync(assetDir)) {
          mkdirSync(assetDir, { recursive: true });
        }
        writeFileSync(assetPath, asset.content);
        assetPaths.push(asset.path);
      }
    }

    // Build skill object
    const source = getSourceForPath(writablePath);
    const skill: Skill = {
      ...metadata,
      path: skillDir,
      instructions,
      source,
      references: refPaths,
      scripts: scriptPaths,
      assets: assetPaths,
    };

    // Update cache
    this.#skillsCache.set(metadata.name, skill);

    return skill;
  }

  async updateSkill(name: string, options: UpdateSkillOptions): Promise<Skill> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    this.#ensureWritable(skill);

    const { metadata: updatedMetadata, instructions: updatedInstructions } = options;

    // Merge metadata
    const newMetadata: SkillMetadata = {
      name: skill.name, // Name cannot be changed
      description: updatedMetadata?.description ?? skill.description,
      license: updatedMetadata?.license ?? skill.license,
      compatibility: updatedMetadata?.compatibility ?? skill.compatibility,
      metadata: updatedMetadata?.metadata ?? skill.metadata,
    };

    const newInstructions = updatedInstructions ?? skill.instructions;

    // Validate if enabled
    if (this.validateOnLoad) {
      const validation = this.#validateSkillMetadata(newMetadata, name);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata:\n${validation.errors.join('\n')}`);
      }
    }

    // Write updated SKILL.md
    const skillMdContent = this.#buildSkillMd(newMetadata, newInstructions);
    writeFileSync(join(skill.path, 'SKILL.md'), skillMdContent, 'utf-8');

    // Update cached skill
    const updatedSkill: Skill = {
      ...skill,
      ...newMetadata,
      instructions: newInstructions,
    };
    this.#skillsCache.set(name, updatedSkill);

    return updatedSkill;
  }

  async deleteSkill(name: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skillsCache.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    this.#ensureWritable(skill);

    // Delete the entire skill directory
    rmSync(skill.path, { recursive: true, force: true });

    // Remove from cache
    this.#skillsCache.delete(name);
  }

  // ============================================================================
  // Refresh
  // ============================================================================

  async refresh(): Promise<void> {
    this.#skillsCache.clear();

    for (const skillsPath of this.paths) {
      const resolvedPath = resolve(skillsPath);
      const source = getSourceForPath(resolvedPath);

      this.#discoverSkillsInPath(resolvedPath, source);
    }

    this.#initialized = true;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Ensure the cache has been initialized
   */
  async #ensureInitialized(): Promise<void> {
    if (!this.#initialized) {
      await this.refresh();
    }
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
              if (this.#skillsCache.has(skill.name)) {
                this.logger.warn(`Duplicate skill name "${skill.name}" found in ${skillFilePath}. Last one wins.`);
              }

              this.#skillsCache.set(skill.name, skill);
            } catch (error) {
              if (error instanceof Error) {
                this.logger.error(`Failed to load skill from ${skillFilePath}: ${error.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to scan skills directory ${skillsPath}: ${error.message}`);
      }
    }
  }

  /**
   * Parse a SKILL.md file
   */
  #parseSkillFile(filePath: string, dirName: string, source: SkillSource): Skill {
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

    // Discover reference, script, and asset files
    const references = this.#discoverFilesInSubdir(skillPath, 'references');
    const scripts = this.#discoverFilesInSubdir(skillPath, 'scripts');
    const assets = this.#discoverFilesInSubdir(skillPath, 'assets');

    return {
      ...metadata,
      path: skillPath,
      instructions: body,
      source,
      references,
      scripts,
      assets,
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
   * Discover files in a subdirectory of a skill (references/, scripts/, assets/)
   */
  #discoverFilesInSubdir(skillPath: string, subdir: 'references' | 'scripts' | 'assets'): string[] {
    const subdirPath = join(skillPath, subdir);
    const files: string[] = [];

    if (!existsSync(subdirPath)) {
      return files;
    }

    try {
      this.#walkDirectory(subdirPath, (filePath: string) => {
        // Get relative path from subdirectory
        const relativePath = filePath.substring(subdirPath.length + 1);
        files.push(relativePath);
      });
    } catch {
      // Failed to read subdirectory
    }

    return files;
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
   * Check if a skill is in a writable path (local or managed, not external)
   */
  #ensureWritable(skill: Skill): void {
    if (!isWritableSource(skill.source)) {
      throw new Error(`Cannot modify skill "${skill.name}" - it is in a read-only external path`);
    }
  }

  /**
   * Get the first writable path from configured paths.
   * Writable paths are 'local' or 'managed' (not 'external'/node_modules).
   */
  #getFirstWritablePath(): string | null {
    for (const skillsPath of this.paths) {
      const resolvedPath = resolve(skillsPath);
      const source = getSourceForPath(resolvedPath);
      if (isWritableSource(source)) {
        return resolvedPath;
      }
    }
    return null;
  }

  /**
   * Build SKILL.md content from metadata and instructions
   */
  #buildSkillMd(metadata: SkillMetadata, instructions: string): string {
    const frontmatter: Record<string, unknown> = {
      name: metadata.name,
      description: metadata.description,
    };

    if (metadata.license) {
      frontmatter.license = metadata.license;
    }
    if (metadata.compatibility) {
      frontmatter.compatibility = metadata.compatibility;
    }
    if (metadata.metadata) {
      frontmatter.metadata = metadata.metadata;
    }

    return matter.stringify(instructions, frontmatter);
  }
}
