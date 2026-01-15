/**
 * WorkspaceSkills - Skills implementation using Workspace filesystem.
 *
 * Provides discovery, search, and CRUD operations for skills stored
 * in workspace's skillsPaths. All operations are async because they
 * use the workspace filesystem provider.
 */

import matter from 'gray-matter';

import type { ContentSource } from '../../artifacts';

import type { SearchEngine } from '../search-engine';
import { parseAllowedTools, validateSkillMetadata } from './schemas';
import type {
  Skill,
  SkillMetadata,
  SkillSearchResult,
  SkillSearchOptions,
  CreateSkillInput,
  UpdateSkillInput,
  WorkspaceSkills,
  SkillSource,
} from './types';
import type { WorkspaceFilesystem } from '../filesystem';

// =============================================================================
// Internal Types
// =============================================================================

interface InternalSkill extends Skill {
  /** Content for BM25 indexing (instructions + all references) */
  indexableContent: string;
}

// =============================================================================
// WorkspaceSkillsImpl
// =============================================================================

/**
 * Configuration for WorkspaceSkillsImpl
 */
export interface WorkspaceSkillsImplConfig {
  /** Workspace filesystem to use for file operations */
  filesystem: WorkspaceFilesystem;
  /** Paths to scan for skills (relative to workspace root) */
  skillsPaths: string[];
  /** Search engine for skill search (optional) */
  searchEngine?: SearchEngine;
  /** Validate skills on load (default: true) */
  validateOnLoad?: boolean;
}

/**
 * Implementation of WorkspaceSkills interface.
 * Uses workspace filesystem for all file operations.
 */
export class WorkspaceSkillsImpl implements WorkspaceSkills {
  readonly #filesystem: WorkspaceFilesystem;
  readonly #skillsPaths: string[];
  readonly #searchEngine?: SearchEngine;
  readonly #validateOnLoad: boolean;

  /** Map of skill name -> full skill data */
  #skills: Map<string, InternalSkill> = new Map();

  /** Whether skills have been discovered */
  #initialized = false;

  constructor(config: WorkspaceSkillsImplConfig) {
    this.#filesystem = config.filesystem;
    this.#skillsPaths = config.skillsPaths;
    this.#searchEngine = config.searchEngine;
    this.#validateOnLoad = config.validateOnLoad ?? true;
  }

  // ===========================================================================
  // Discovery
  // ===========================================================================

  async list(): Promise<SkillMetadata[]> {
    await this.#ensureInitialized();
    return Array.from(this.#skills.values()).map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
      compatibility: skill.compatibility,
      metadata: skill.metadata,
      allowedTools: skill.allowedTools,
    }));
  }

  async get(name: string): Promise<Skill | null> {
    await this.#ensureInitialized();
    const skill = this.#skills.get(name);
    if (!skill) return null;

    // Return without internal indexableContent field
    const { indexableContent: _, ...skillData } = skill;
    return skillData;
  }

  async has(name: string): Promise<boolean> {
    await this.#ensureInitialized();
    return this.#skills.has(name);
  }

  async refresh(): Promise<void> {
    this.#skills.clear();
    this.#searchEngine?.clear();
    this.#initialized = false;
    await this.#discoverSkills();
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async search(query: string, options: SkillSearchOptions = {}): Promise<SkillSearchResult[]> {
    await this.#ensureInitialized();

    if (!this.#searchEngine) {
      // Fall back to simple text matching if no search engine
      return this.#simpleSearch(query, options);
    }

    const { topK = 5, minScore, skillNames, includeReferences = true, mode } = options;

    // Get more results than needed to filter by skillNames/includeReferences
    const expandedTopK = skillNames ? topK * 3 : topK;

    // Delegate to SearchEngine
    const searchResults = await this.#searchEngine.search(query, {
      topK: expandedTopK,
      minScore,
      mode,
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

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  async create(input: CreateSkillInput): Promise<Skill> {
    await this.#ensureInitialized();

    const { metadata, instructions, references, scripts, assets } = input;

    // Check if skill already exists
    if (this.#skills.has(metadata.name)) {
      throw new Error(`Skill "${metadata.name}" already exists`);
    }

    // Validate the skill metadata
    if (this.#validateOnLoad) {
      const validation = this.#validateSkillMetadata(metadata, metadata.name, instructions);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata:\n${validation.errors.join('\n')}`);
      }
    }

    // Use first skills path for creating new skills
    const skillsPath = this.#skillsPaths[0];
    if (!skillsPath) {
      throw new Error('No skills path configured for creating skills');
    }

    const skillDir = this.#joinPath(skillsPath, metadata.name);

    // Check if directory already exists
    if (await this.#filesystem.exists(skillDir)) {
      throw new Error(`Directory "${skillDir}" already exists`);
    }

    // Create skill directory
    await this.#filesystem.mkdir(skillDir);

    // Build SKILL.md content
    const skillMdContent = this.#buildSkillMd(metadata, instructions);
    await this.#filesystem.writeFile(this.#joinPath(skillDir, 'SKILL.md'), skillMdContent);

    // Create reference files
    const refPaths: string[] = [];
    if (references && references.length > 0) {
      const refsDir = this.#joinPath(skillDir, 'references');
      await this.#filesystem.mkdir(refsDir);
      for (const ref of references) {
        const refPath = this.#joinPath(refsDir, ref.path);
        await this.#ensureParentDir(refPath);
        await this.#filesystem.writeFile(refPath, ref.content);
        refPaths.push(ref.path);
      }
    }

    // Create script files
    const scriptPaths: string[] = [];
    if (scripts && scripts.length > 0) {
      const scriptsDir = this.#joinPath(skillDir, 'scripts');
      await this.#filesystem.mkdir(scriptsDir);
      for (const script of scripts) {
        const scriptPath = this.#joinPath(scriptsDir, script.path);
        await this.#ensureParentDir(scriptPath);
        await this.#filesystem.writeFile(scriptPath, script.content);
        scriptPaths.push(script.path);
      }
    }

    // Create asset files
    const assetPaths: string[] = [];
    if (assets && assets.length > 0) {
      const assetsDir = this.#joinPath(skillDir, 'assets');
      await this.#filesystem.mkdir(assetsDir);
      for (const asset of assets) {
        const assetPath = this.#joinPath(assetsDir, asset.path);
        await this.#ensureParentDir(assetPath);
        await this.#filesystem.writeFile(assetPath, asset.content);
        assetPaths.push(asset.path);
      }
    }

    // Build skill object
    const source = this.#determineSource(skillsPath);
    const indexableContent = await this.#buildIndexableContent(instructions, skillDir, refPaths);

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
    await this.#indexSkill(skill);

    // Return without internal indexableContent field
    const { indexableContent: _, ...skillData } = skill;
    return skillData;
  }

  async update(name: string, input: UpdateSkillInput): Promise<Skill> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

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
    if (this.#validateOnLoad) {
      const validation = this.#validateSkillMetadata(newMetadata, name, newInstructions);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata:\n${validation.errors.join('\n')}`);
      }
    }

    // Write updated SKILL.md
    const skillMdContent = this.#buildSkillMd(newMetadata, newInstructions);
    await this.#filesystem.writeFile(this.#joinPath(skill.path, 'SKILL.md'), skillMdContent);

    // Update cached skill
    const indexableContent = await this.#buildIndexableContent(newInstructions, skill.path, skill.references);
    const updatedSkill: InternalSkill = {
      ...skill,
      ...newMetadata,
      instructions: newInstructions,
      indexableContent,
    };
    this.#skills.set(name, updatedSkill);

    // Re-index the skill
    await this.#indexSkill(updatedSkill);

    // Return without internal indexableContent field
    const { indexableContent: _, ...skillData } = updatedSkill;
    return skillData;
  }

  async delete(name: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    // Delete the entire skill directory
    await this.#filesystem.rmdir(skill.path, { recursive: true });

    // Remove from cache
    this.#skills.delete(name);

    // Note: SearchEngine doesn't currently support removing individual documents,
    // so a full refresh() would be needed to remove from index
  }

  // ===========================================================================
  // Single-item Accessors
  // ===========================================================================

  async getReference(skillName: string, referencePath: string): Promise<string | null> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return null;

    const refFilePath = this.#joinPath(skill.path, 'references', referencePath);

    if (!(await this.#filesystem.exists(refFilePath))) {
      return null;
    }

    try {
      const content = await this.#filesystem.readFile(refFilePath);
      return typeof content === 'string' ? content : content.toString('utf-8');
    } catch {
      return null;
    }
  }

  async getScript(skillName: string, scriptPath: string): Promise<string | null> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return null;

    const scriptFilePath = this.#joinPath(skill.path, 'scripts', scriptPath);

    if (!(await this.#filesystem.exists(scriptFilePath))) {
      return null;
    }

    try {
      const content = await this.#filesystem.readFile(scriptFilePath);
      return typeof content === 'string' ? content : content.toString('utf-8');
    } catch {
      return null;
    }
  }

  async getAsset(skillName: string, assetPath: string): Promise<Buffer | null> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return null;

    const assetFilePath = this.#joinPath(skill.path, 'assets', assetPath);

    if (!(await this.#filesystem.exists(assetFilePath))) {
      return null;
    }

    try {
      const content = await this.#filesystem.readFile(assetFilePath);
      return typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Listing Accessors
  // ===========================================================================

  async listReferences(skillName: string): Promise<string[]> {
    await this.#ensureInitialized();
    const skill = this.#skills.get(skillName);
    return skill?.references ?? [];
  }

  async listScripts(skillName: string): Promise<string[]> {
    await this.#ensureInitialized();
    const skill = this.#skills.get(skillName);
    return skill?.scripts ?? [];
  }

  async listAssets(skillName: string): Promise<string[]> {
    await this.#ensureInitialized();
    const skill = this.#skills.get(skillName);
    return skill?.assets ?? [];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Ensure skills have been discovered
   */
  async #ensureInitialized(): Promise<void> {
    if (!this.#initialized) {
      await this.#discoverSkills();
      this.#initialized = true;
    }
  }

  /**
   * Discover skills from all skillsPaths
   */
  async #discoverSkills(): Promise<void> {
    for (const skillsPath of this.#skillsPaths) {
      const source = this.#determineSource(skillsPath);
      await this.#discoverSkillsInPath(skillsPath, source);
    }
  }

  /**
   * Discover skills in a single path
   */
  async #discoverSkillsInPath(skillsPath: string, source: SkillSource): Promise<void> {
    if (!(await this.#filesystem.exists(skillsPath))) {
      return;
    }

    try {
      const entries = await this.#filesystem.readdir(skillsPath);

      for (const entry of entries) {
        if (entry.type !== 'directory') continue;

        const entryPath = this.#joinPath(skillsPath, entry.name);
        const skillFilePath = this.#joinPath(entryPath, 'SKILL.md');

        if (await this.#filesystem.exists(skillFilePath)) {
          try {
            const skill = await this.#parseSkillFile(skillFilePath, entry.name, source);

            // Check for duplicate names
            if (this.#skills.has(skill.name)) {
              console.warn(
                `[WorkspaceSkills] Duplicate skill name "${skill.name}" found in ${skillFilePath}. Last one wins.`,
              );
            }

            this.#skills.set(skill.name, skill);

            // Index the skill content for search
            await this.#indexSkill(skill);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`[WorkspaceSkills] Failed to load skill from ${skillFilePath}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[WorkspaceSkills] Failed to scan skills directory ${skillsPath}:`, error.message);
      }
    }
  }

  /**
   * Parse a SKILL.md file
   */
  async #parseSkillFile(filePath: string, dirName: string, source: SkillSource): Promise<InternalSkill> {
    const rawContent = await this.#filesystem.readFile(filePath);
    const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');

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
    if (this.#validateOnLoad) {
      const validation = this.#validateSkillMetadata(metadata, dirName, body);
      if (!validation.valid) {
        throw new Error(`Invalid skill metadata in ${filePath}:\n${validation.errors.join('\n')}`);
      }
    }

    // Get skill directory path (parent of SKILL.md)
    const skillPath = this.#getParentPath(filePath);

    // Discover reference, script, and asset files
    const references = await this.#discoverFilesInSubdir(skillPath, 'references');
    const scripts = await this.#discoverFilesInSubdir(skillPath, 'scripts');
    const assets = await this.#discoverFilesInSubdir(skillPath, 'assets');

    // Build indexable content (instructions + references)
    const indexableContent = await this.#buildIndexableContent(body, skillPath, references);

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
        console.warn(`[WorkspaceSkills] ${metadata.name}: ${warning}`);
      }
    }

    return result;
  }

  /**
   * Discover files in a subdirectory of a skill (references/, scripts/, assets/)
   */
  async #discoverFilesInSubdir(skillPath: string, subdir: 'references' | 'scripts' | 'assets'): Promise<string[]> {
    const subdirPath = this.#joinPath(skillPath, subdir);
    const files: string[] = [];

    if (!(await this.#filesystem.exists(subdirPath))) {
      return files;
    }

    try {
      await this.#walkDirectory(subdirPath, subdirPath, (relativePath: string) => {
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
  async #walkDirectory(basePath: string, dirPath: string, callback: (relativePath: string) => void): Promise<void> {
    const entries = await this.#filesystem.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = this.#joinPath(dirPath, entry.name);

      if (entry.type === 'directory') {
        await this.#walkDirectory(basePath, entryPath, callback);
      } else {
        // Get relative path from base
        const relativePath = entryPath.substring(basePath.length + 1);
        callback(relativePath);
      }
    }
  }

  /**
   * Build indexable content from instructions and references
   */
  async #buildIndexableContent(instructions: string, skillPath: string, references: string[]): Promise<string> {
    const parts = [instructions];

    for (const refPath of references) {
      const fullPath = this.#joinPath(skillPath, 'references', refPath);
      try {
        const rawContent = await this.#filesystem.readFile(fullPath);
        const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');
        parts.push(content);
      } catch {
        // Skip files that can't be read
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Index a skill for search
   */
  async #indexSkill(skill: InternalSkill): Promise<void> {
    if (!this.#searchEngine) return;

    // Index the main skill instructions
    await this.#searchEngine.index({
      id: `skill:${skill.name}:SKILL.md`,
      content: skill.instructions,
      metadata: {
        skillName: skill.name,
        source: 'SKILL.md',
      },
    });

    // Index each reference file separately
    for (const refPath of skill.references) {
      const fullPath = this.#joinPath(skill.path, 'references', refPath);
      try {
        const rawContent = await this.#filesystem.readFile(fullPath);
        const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');
        await this.#searchEngine.index({
          id: `skill:${skill.name}:${refPath}`,
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
   * Simple text search fallback when no search engine is configured
   */
  async #simpleSearch(query: string, options: SkillSearchOptions): Promise<SkillSearchResult[]> {
    const { topK = 5, skillNames, includeReferences = true } = options;
    const queryLower = query.toLowerCase();
    const results: SkillSearchResult[] = [];

    for (const skill of this.#skills.values()) {
      // Filter by skill names if specified
      if (skillNames && !skillNames.includes(skill.name)) {
        continue;
      }

      // Search in instructions
      if (skill.instructions.toLowerCase().includes(queryLower)) {
        results.push({
          skillName: skill.name,
          source: 'SKILL.md',
          content: skill.instructions.substring(0, 200),
          score: 1,
        });
      }

      // Search in references if included
      if (includeReferences) {
        for (const refPath of skill.references) {
          const content = await this.getReference(skill.name, refPath);
          if (content && content.toLowerCase().includes(queryLower)) {
            results.push({
              skillName: skill.name,
              source: `references/${refPath}`,
              content: content.substring(0, 200),
              score: 0.8,
            });
          }
        }
      }

      if (results.length >= topK) break;
    }

    return results.slice(0, topK);
  }

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

  /**
   * Join path segments (workspace paths use forward slashes)
   */
  #joinPath(...segments: string[]): string {
    return segments
      .map((seg, i) => {
        if (i === 0) return seg.replace(/\/+$/, '');
        return seg.replace(/^\/+|\/+$/g, '');
      })
      .filter(Boolean)
      .join('/');
  }

  /**
   * Get parent path
   */
  #getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
  }

  /**
   * Ensure parent directory exists for a file path
   */
  async #ensureParentDir(filePath: string): Promise<void> {
    const parentPath = this.#getParentPath(filePath);
    if (parentPath && parentPath !== '/' && !(await this.#filesystem.exists(parentPath))) {
      await this.#filesystem.mkdir(parentPath);
    }
  }
}
