import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import type { MastraVector } from '@mastra/core/vector';
import matter from 'gray-matter';

import { SearchEngine } from './search-engine';
import type { Embedder, SearchEngineConfig, BM25SearchConfig } from './search-engine';
import { validateSkillMetadata, parseAllowedTools } from './schemas';
import type {
  Skill,
  SkillMetadata,
  SkillSource,
  SkillsConfig,
  SkillSearchResult,
  SkillSearchOptions,
  MastraSkills,
  CreateSkillInput,
  UpdateSkillInput,
} from './types';

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
 * Configuration for vector search indexing
 */
export interface SkillsIndexConfig {
  /** Vector store for semantic search */
  vectorStore: MastraVector;
  /** Embedder function for generating vectors */
  embedder: Embedder;
  /** Index name for the vector store (default: skills-{id}) */
  indexName?: string;
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

  /** Unified search engine */
  #searchEngine: SearchEngine;

  constructor(
    config: SkillsConfig,
    options?: {
      bm25?: BM25SearchConfig;
      index?: SkillsIndexConfig;
    },
  ) {
    this.id = config.id;
    this.paths = Array.isArray(config.paths) ? config.paths : [config.paths];
    this.validateOnLoad = config.validateOnLoad ?? true;

    // Build SearchEngine config
    const searchEngineConfig: SearchEngineConfig = {};

    // Always enable BM25 (Skills uses BM25 by default)
    searchEngineConfig.bm25 = {
      bm25: options?.bm25?.bm25,
      tokenize: options?.bm25?.tokenize,
    };

    // Add vector config if provided
    if (options?.index) {
      const vectorIndexName = options.index.indexName ?? `skills_${this.id.replace(/-/g, '_')}`;
      searchEngineConfig.vector = {
        vectorStore: options.index.vectorStore,
        embedder: options.index.embedder,
        indexName: vectorIndexName,
      };
      // Use lazy vector indexing for Skills (indexes on first search)
      searchEngineConfig.lazyVectorIndex = true;
    }

    this.#searchEngine = new SearchEngine(searchEngineConfig);

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
      allowedTools: skill.allowedTools,
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
   * Search across all skills content using BM25, vector, or hybrid search
   */
  async search(query: string, options: SkillSearchOptions = {}): Promise<SkillSearchResult[]> {
    const { topK = 5, minScore, skillNames, includeReferences = true, mode, hybrid } = options;

    // Get more results than needed to filter by skillNames/includeReferences
    const expandedTopK = skillNames ? topK * 3 : topK;

    // Delegate to SearchEngine
    const searchResults = await this.#searchEngine.search(query, {
      topK: expandedTopK,
      minScore,
      mode,
      vectorWeight: hybrid?.vectorWeight,
    });

    const results: SkillSearchResult[] = [];

    for (const result of searchResults) {
      const skillName = result.metadata?.skillName as string;
      const source = result.metadata?.source as string;

      if (!skillName || !source) continue;

      // Filter by skill names if specified
      if (skillNames && !skillNames.includes(skillName)) {
        continue;
      }

      // Filter out references if not included
      if (!includeReferences && source !== 'SKILL.md') {
        continue;
      }

      results.push({
        skillName,
        source,
        content: result.content,
        score: result.score,
        lineRange: result.lineRange,
        scoreDetails: result.scoreDetails,
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
   * Get script file content from a skill
   */
  getScript(skillName: string, scriptPath: string): string | undefined {
    const skill = this.#skills.get(skillName);
    if (!skill) return undefined;

    const scriptFilePath = join(skill.path, 'scripts', scriptPath);

    if (!existsSync(scriptFilePath)) {
      return undefined;
    }

    try {
      return readFileSync(scriptFilePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * Get all script file paths for a skill
   */
  getScripts(skillName: string): string[] {
    const skill = this.#skills.get(skillName);
    return skill?.scripts ?? [];
  }

  /**
   * Get asset file content from a skill (returns Buffer for binary files)
   */
  getAsset(skillName: string, assetPath: string): Buffer | undefined {
    const skill = this.#skills.get(skillName);
    if (!skill) return undefined;

    const assetFilePath = join(skill.path, 'assets', assetPath);

    if (!existsSync(assetFilePath)) {
      return undefined;
    }

    try {
      return readFileSync(assetFilePath);
    } catch {
      return undefined;
    }
  }

  /**
   * Get all asset file paths for a skill
   */
  getAssets(skillName: string): string[] {
    const skill = this.#skills.get(skillName);
    return skill?.assets ?? [];
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Create a new skill.
   * Creates a skill directory with SKILL.md and optional reference/script/asset files.
   *
   * @param input - Skill creation input
   * @throws Error if no writable path is available or skill already exists
   */
  async create(input: CreateSkillInput): Promise<Skill> {
    const { metadata, instructions, references, scripts, assets } = input;

    // Check if skill already exists
    if (this.#skills.has(metadata.name)) {
      throw new Error(`Skill "${metadata.name}" already exists`);
    }

    // Find first writable path
    const writablePath = this.#getFirstWritablePath();
    if (!writablePath) {
      throw new Error('No writable path available for creating skills');
    }

    // Validate the skill metadata
    if (this.validateOnLoad) {
      const validation = this.#validateSkillMetadata(metadata, metadata.name, instructions);
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
    const source = this.#determineSource(writablePath);
    const indexableContent = this.#buildIndexableContent(instructions, skillDir, refPaths);

    const skill: InternalSkill = {
      ...metadata,
      path: skillDir,
      instructions,
      source,
      references: refPaths,
      scripts: scriptPaths,
      assets: assetPaths,
      indexableContent,
    };

    // Update cache and index
    this.#skills.set(metadata.name, skill);
    this.#indexSkill(skill);

    // Return without internal indexableContent field
    const { indexableContent: _, ...skillData } = skill;
    return skillData;
  }

  /**
   * Update an existing skill.
   * Only works for skills in writable paths (local or managed).
   *
   * @param name - Name of the skill to update
   * @param input - Update input (partial metadata and/or instructions)
   * @throws Error if skill doesn't exist or is in a read-only path
   */
  async update(name: string, input: UpdateSkillInput): Promise<Skill> {
    const skill = this.#skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    this.#ensureWritable(skill);

    const { metadata: updatedMetadata, instructions: updatedInstructions } = input;

    // Merge metadata
    const newMetadata: SkillMetadata = {
      name: skill.name, // Name cannot be changed
      description: updatedMetadata?.description ?? skill.description,
      license: updatedMetadata?.license ?? skill.license,
      compatibility: updatedMetadata?.compatibility ?? skill.compatibility,
      metadata: updatedMetadata?.metadata ?? skill.metadata,
      allowedTools: skill.allowedTools, // Preserve allowedTools
    };

    const newInstructions = updatedInstructions ?? skill.instructions;

    // Validate if enabled
    if (this.validateOnLoad) {
      const validation = this.#validateSkillMetadata(newMetadata, name, newInstructions);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata:\n${validation.errors.join('\n')}`);
      }
    }

    // Write updated SKILL.md
    const skillMdContent = this.#buildSkillMd(newMetadata, newInstructions);
    writeFileSync(join(skill.path, 'SKILL.md'), skillMdContent, 'utf-8');

    // Update cached skill
    const indexableContent = this.#buildIndexableContent(newInstructions, skill.path, skill.references);
    const updatedSkill: InternalSkill = {
      ...skill,
      ...newMetadata,
      instructions: newInstructions,
      indexableContent,
    };
    this.#skills.set(name, updatedSkill);

    // Re-index the skill
    this.#indexSkill(updatedSkill);

    // Return without internal indexableContent field
    const { indexableContent: _, ...skillData } = updatedSkill;
    return skillData;
  }

  /**
   * Delete a skill.
   * Only works for skills in writable paths (local or managed).
   *
   * @param name - Name of the skill to delete
   * @throws Error if skill doesn't exist or is in a read-only path
   */
  async delete(name: string): Promise<void> {
    const skill = this.#skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    this.#ensureWritable(skill);

    // Delete the entire skill directory
    rmSync(skill.path, { recursive: true, force: true });

    // Remove from cache
    this.#skills.delete(name);

    // Note: SearchEngine doesn't currently support removing individual documents,
    // so a full refresh() would be needed to remove from index
  }

  /**
   * Refresh skills from disk (re-scan directories)
   */
  refresh(): void {
    this.#skills.clear();
    this.#searchEngine.clear();

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

    // Parse allowed-tools (can be space-delimited string or array in YAML)
    const allowedTools = parseAllowedTools(frontmatter['allowed-tools'] ?? frontmatter.allowedTools);

    // Extract required fields
    const metadata: SkillMetadata = {
      name: frontmatter.name,
      description: frontmatter.description,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
      metadata: frontmatter.metadata,
      allowedTools,
    };

    // Validate if enabled (includes token/line count warnings)
    if (this.validateOnLoad) {
      const validation = this.#validateSkillMetadata(metadata, dirName, body);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata in ${filePath}:\n${validation.errors.join('\n')}`);
      }
    }

    const skillPath = filePath.substring(0, filePath.lastIndexOf('/'));

    // Discover reference, script, and asset files
    const references = this.#discoverFilesInSubdir(skillPath, 'references');
    const scripts = this.#discoverFilesInSubdir(skillPath, 'scripts');
    const assets = this.#discoverFilesInSubdir(skillPath, 'assets');

    // Build indexable content (instructions + references)
    const indexableContent = this.#buildIndexableContent(body, skillPath, references);

    return {
      ...metadata,
      path: skillPath,
      instructions: body,
      source,
      references,
      scripts,
      assets,
      indexableContent,
    };
  }

  /**
   * Validate skill metadata (delegates to shared validation function)
   */
  #validateSkillMetadata(
    metadata: SkillMetadata,
    dirName: string,
    instructions?: string,
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const result = validateSkillMetadata(metadata, dirName, instructions);

    // Log warnings if any
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.warn(`[Skills] ${metadata.name}: ${warning}`);
      }
    }

    return result;
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
   * Index a skill for search (both BM25 and vector via SearchEngine)
   */
  #indexSkill(skill: InternalSkill): void {
    // Index the main skill instructions
    // Note: We use void here because indexing is sync for BM25 and lazy for vector
    void this.#searchEngine.index({
      id: `${skill.name}:SKILL.md`,
      content: skill.instructions,
      metadata: {
        skillName: skill.name,
        source: 'SKILL.md',
      },
    });

    // Index each reference file separately
    for (const refPath of skill.references) {
      const fullPath = join(skill.path, 'references', refPath);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        void this.#searchEngine.index({
          id: `${skill.name}:${refPath}`,
          content,
          metadata: {
            skillName: skill.name,
            source: `references/${refPath}`,
          },
        });
      } catch {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Check if a skill is in a writable path (local or managed, not external)
   */
  #ensureWritable(skill: InternalSkill): void {
    if (skill.source.type === 'external') {
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
      const source = this.#determineSource(resolvedPath);
      if (source.type !== 'external') {
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
    if (metadata.allowedTools && metadata.allowedTools.length > 0) {
      frontmatter['allowed-tools'] = metadata.allowedTools.join(' ');
    }

    return matter.stringify(instructions, frontmatter);
  }
}
