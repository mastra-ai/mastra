/**
 * WorkspaceSkills - Skills implementation.
 *
 * Provides discovery and search operations for skills stored
 * in skills paths. All operations are async.
 */

import matter from 'gray-matter';

import { isGlobPattern, extractGlobBase, createGlobMatcher } from '../glob';
import type { IndexDocument, SearchResult } from '../search';
import { validateSkillMetadata } from './schemas';
import type { SkillSource as SkillSourceInterface } from './skill-source';
import type {
  ContentSource,
  Skill,
  SkillMetadata,
  SkillSearchResult,
  SkillSearchOptions,
  WorkspaceSkills,
  SkillsResolver,
  SkillsContext,
} from './types';

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Minimal search engine interface - only the methods we actually use.
 * This allows both the real SearchEngine and test mocks to be used.
 */
interface SkillSearchEngine {
  index(doc: IndexDocument): Promise<void>;
  remove?(id: string): Promise<void>;
  search(
    query: string,
    options?: { topK?: number; minScore?: number; mode?: 'bm25' | 'vector' | 'hybrid' },
  ): Promise<SearchResult[]>;
  clear(): void;
}

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
  /**
   * Source for loading skills.
   */
  source: SkillSourceInterface;
  /**
   * Paths to scan for skills.
   * Can be a static array or a function that returns paths based on context.
   */
  skills: SkillsResolver;
  /** Search engine for skill search (optional) */
  searchEngine?: SkillSearchEngine;
  /** Validate skills on load (default: true) */
  validateOnLoad?: boolean;
}

/**
 * Implementation of WorkspaceSkills interface.
 */
export class WorkspaceSkillsImpl implements WorkspaceSkills {
  readonly #source: SkillSourceInterface;
  readonly #skillsResolver: SkillsResolver;
  readonly #searchEngine?: SkillSearchEngine;
  readonly #validateOnLoad: boolean;

  /** Map of skill name -> full skill data */
  #skills: Map<string, InternalSkill> = new Map();

  /** Whether skills have been discovered */
  #initialized = false;

  /** Promise for ongoing initialization (prevents concurrent discovery) */
  #initPromise: Promise<void> | null = null;

  /** Timestamp of last skills discovery (for staleness check) */
  #lastDiscoveryTime = 0;

  /** Currently resolved skills paths (used to detect changes) */
  #resolvedPaths: string[] = [];

  /** Cached glob-resolved directories and per-pattern resolve timestamps */
  #globDirCache: Map<string, string[]> = new Map();
  #globResolveTimes: Map<string, number> = new Map();
  static readonly GLOB_RESOLVE_INTERVAL = 5_000; // Re-walk glob dirs every 5s
  static readonly STALENESS_CHECK_COOLDOWN = 2_000; // Skip staleness check for 2s after discovery

  constructor(config: WorkspaceSkillsImplConfig) {
    this.#source = config.source;
    this.#skillsResolver = config.skills;
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
    this.#initPromise = null;
    await this.#discoverSkills();
    this.#initialized = true;
  }

  async maybeRefresh(context?: SkillsContext): Promise<void> {
    // Ensure initial discovery is complete
    await this.#ensureInitialized();

    // Resolve current paths (may be dynamic based on context)
    const currentPaths = await this.#resolvePaths(context);

    // Check if paths have changed (for dynamic resolvers)
    const pathsChanged = !this.#arePathsEqual(this.#resolvedPaths, currentPaths);
    if (pathsChanged) {
      // Paths changed - need full refresh with new paths
      this.#resolvedPaths = currentPaths;
      await this.refresh();
      return;
    }

    // Check if any skills path has been modified since last discovery
    const isStale = await this.#isSkillsPathStale();
    if (isStale) {
      await this.refresh();
    }
  }

  async addSkill(skillPath: string): Promise<void> {
    await this.#ensureInitialized();

    // Determine SKILL.md path and dirName
    let skillFilePath: string;
    let dirName: string;
    if (skillPath.endsWith('/SKILL.md') || skillPath === 'SKILL.md') {
      skillFilePath = skillPath;
      dirName = this.#getParentPath(skillPath).split('/').pop() || 'unknown';
    } else {
      skillFilePath = this.#joinPath(skillPath, 'SKILL.md');
      dirName = skillPath.split('/').pop() || 'unknown';
    }

    // Determine source from existing resolved paths
    const source = this.#inferSource(skillPath);

    // Parse and add to cache
    const skill = await this.#parseSkillFile(skillFilePath, dirName, source);

    // Remove old index entries if skill already exists (for update case)
    const existing = this.#skills.get(skill.name);
    if (existing) {
      await this.#removeSkillFromIndex(existing);
    }

    this.#skills.set(skill.name, skill);
    await this.#indexSkill(skill);

    // Update discovery time so maybeRefresh() doesn't trigger full scan
    this.#lastDiscoveryTime = Date.now();
  }

  async removeSkill(skillName: string): Promise<void> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return;

    // Remove from search index
    await this.#removeSkillFromIndex(skill);

    // Remove from cache
    this.#skills.delete(skillName);

    // Update discovery time so maybeRefresh() doesn't trigger full scan
    this.#lastDiscoveryTime = Date.now();
  }

  /**
   * Resolve skills paths from the resolver (static array or function).
   */
  async #resolvePaths(context?: SkillsContext): Promise<string[]> {
    if (Array.isArray(this.#skillsResolver)) {
      return this.#skillsResolver;
    }
    return this.#skillsResolver(context ?? {});
  }

  /**
   * Compare two path arrays for equality (order-independent).
   */
  #arePathsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((path, i) => path === sortedB[i]);
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
  // Single-item Accessors
  // ===========================================================================

  async getReference(skillName: string, referencePath: string): Promise<string | null> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return null;

    const safeRefPath = this.#assertRelativePath(referencePath, 'reference');
    const refFilePath = this.#joinPath(skill.path, safeRefPath);

    if (!(await this.#source.exists(refFilePath))) {
      return null;
    }

    try {
      const content = await this.#source.readFile(refFilePath);
      return typeof content === 'string' ? content : content.toString('utf-8');
    } catch {
      return null;
    }
  }

  async getScript(skillName: string, scriptPath: string): Promise<string | null> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return null;

    const safeScriptPath = this.#assertRelativePath(scriptPath, 'script');
    const scriptFilePath = this.#joinPath(skill.path, safeScriptPath);

    if (!(await this.#source.exists(scriptFilePath))) {
      return null;
    }

    try {
      const content = await this.#source.readFile(scriptFilePath);
      return typeof content === 'string' ? content : content.toString('utf-8');
    } catch {
      return null;
    }
  }

  async getAsset(skillName: string, assetPath: string): Promise<Buffer | null> {
    await this.#ensureInitialized();

    const skill = this.#skills.get(skillName);
    if (!skill) return null;

    const safeAssetPath = this.#assertRelativePath(assetPath, 'asset');
    const assetFilePath = this.#joinPath(skill.path, safeAssetPath);

    if (!(await this.#source.exists(assetFilePath))) {
      return null;
    }

    try {
      const content = await this.#source.readFile(assetFilePath);
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
   * Ensure skills have been discovered.
   * Uses a promise to prevent concurrent discovery.
   */
  async #ensureInitialized(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.#initPromise) {
      await this.#initPromise;
      return;
    }

    // Start initialization and store the promise
    this.#initPromise = (async () => {
      try {
        // Resolve paths on first initialization (uses empty context)
        if (this.#resolvedPaths.length === 0) {
          this.#resolvedPaths = await this.#resolvePaths();
        }
        await this.#discoverSkills();
        this.#initialized = true;
      } finally {
        this.#initPromise = null;
      }
    })();

    await this.#initPromise;
  }

  /**
   * Discover skills from all skills paths.
   * Uses currently resolved paths (must be set before calling).
   *
   * Paths can be plain directories (e.g., '/skills') or glob patterns
   * (e.g., '**\/skills'). Glob patterns resolve to directories that match
   * the pattern, each of which is then scanned for skills.
   */
  async #discoverSkills(): Promise<void> {
    // Clear glob cache so discovery gets fresh results
    this.#globDirCache.clear();
    this.#globResolveTimes.clear();

    for (const skillsPath of this.#resolvedPaths) {
      const source = this.#determineSource(skillsPath);

      if (isGlobPattern(skillsPath)) {
        // Glob pattern: resolve to matching directories, then discover in each
        const matchingDirs = await this.#resolveGlobToDirectories(skillsPath);
        // Cache for subsequent staleness checks
        this.#globDirCache.set(skillsPath, matchingDirs);
        this.#globResolveTimes.set(skillsPath, Date.now());
        for (const dir of matchingDirs) {
          await this.#discoverSkillsInPath(dir, source);
        }
      } else {
        // Check if the path is a direct skill reference (directory with SKILL.md or SKILL.md file)
        const isDirect = await this.#discoverDirectSkill(skillsPath, source);
        if (!isDirect) {
          // Plain path: scan subdirectories for skills
          await this.#discoverSkillsInPath(skillsPath, source);
        }
      }
    }
    // Track when discovery completed for staleness check
    this.#lastDiscoveryTime = Date.now();
  }

  /**
   * Resolve a glob pattern to a list of matching directories.
   * Walks from extractGlobBase() and tests each directory against the pattern.
   *
   * Note: Broad patterns like `/** /skills` resolve to a walk root of `/`,
   * scanning the entire workspace tree. This is cached per-pattern with a
   * TTL (GLOB_RESOLVE_INTERVAL) to limit I/O. For large workspaces, prefer
   * more specific patterns like `/src/** /skills` to narrow the walk root.
   */
  async #resolveGlobToDirectories(pattern: string): Promise<string[]> {
    const walkRoot = extractGlobBase(pattern);
    const matcher = createGlobMatcher(pattern, { dot: true });
    const matchingDirs: string[] = [];

    await this.#walkForDirectories(walkRoot, dirPath => {
      if (matcher(dirPath)) {
        matchingDirs.push(dirPath);
      }
    });

    return matchingDirs;
  }

  /**
   * Walk a directory tree and call callback for each directory found.
   */
  async #walkForDirectories(
    basePath: string,
    callback: (dirPath: string) => void,
    depth: number = 0,
    maxDepth: number = 4,
  ): Promise<void> {
    if (depth >= maxDepth) return;

    try {
      const entries = await this.#source.readdir(basePath);
      for (const entry of entries) {
        // Skip symlink directories to prevent infinite recursion from cycles
        if (entry.type !== 'directory' || entry.isSymlink) continue;
        // Use explicit path construction to handle root '/' correctly
        // (#joinPath strips root '/', so we handle it directly)
        const entryPath = basePath === '/' ? `/${entry.name}` : `${basePath}/${entry.name}`;
        callback(entryPath);
        await this.#walkForDirectories(entryPath, callback, depth + 1, maxDepth);
      }
    } catch {
      // Directory doesn't exist or can't be read, skip
    }
  }

  /**
   * Discover skills in a single path
   */
  async #discoverSkillsInPath(skillsPath: string, source: ContentSource): Promise<void> {
    try {
      if (!(await this.#source.exists(skillsPath))) {
        return;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`[WorkspaceSkills] Cannot access skills path "${skillsPath}": ${error.message}`);
      } else {
        console.warn(`[WorkspaceSkills] Cannot access skills path "${skillsPath}": ${String(error)}`);
      }
      return;
    }

    try {
      const entries = await this.#source.readdir(skillsPath);

      for (const entry of entries) {
        if (entry.type !== 'directory') continue;

        const entryPath = this.#joinPath(skillsPath, entry.name);
        const skillFilePath = this.#joinPath(entryPath, 'SKILL.md');

        if (await this.#source.exists(skillFilePath)) {
          try {
            const skill = await this.#parseSkillFile(skillFilePath, entry.name, source);

            // Set skill (later discoveries overwrite earlier ones)
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
   * Attempt to discover a skill from a direct path reference.
   *
   * Handles two cases:
   * - Path ends with `/SKILL.md` → parse directly, extract dirName from parent
   * - Path is a directory containing `SKILL.md` → parse it as a single skill
   *
   * Returns `true` if the path was a direct skill reference (skip subdirectory scan),
   * `false` to fall through to the normal subdirectory scan.
   */
  async #discoverDirectSkill(skillsPath: string, source: ContentSource): Promise<boolean> {
    try {
      // Case 1: Path points directly to a SKILL.md file
      if (skillsPath.endsWith('/SKILL.md') || skillsPath === 'SKILL.md') {
        if (!(await this.#source.exists(skillsPath))) {
          return true; // It was a direct reference, just doesn't exist — skip subdirectory scan
        }

        const skillDir = this.#getParentPath(skillsPath);
        const dirName = skillDir.split('/').pop() || skillDir;

        try {
          const skill = await this.#parseSkillFile(skillsPath, dirName, source);
          this.#skills.set(skill.name, skill);
          await this.#indexSkill(skill);
        } catch (error) {
          if (error instanceof Error) {
            console.error(`[WorkspaceSkills] Failed to load skill from ${skillsPath}:`, error.message);
          }
        }
        return true;
      }

      // Case 2: Path is a directory that directly contains SKILL.md
      if (await this.#source.exists(skillsPath)) {
        const skillFilePath = this.#joinPath(skillsPath, 'SKILL.md');
        if (await this.#source.exists(skillFilePath)) {
          const dirName = skillsPath.split('/').pop() || skillsPath;

          try {
            const skill = await this.#parseSkillFile(skillFilePath, dirName, source);
            this.#skills.set(skill.name, skill);
            await this.#indexSkill(skill);
          } catch (error) {
            if (error instanceof Error) {
              console.error(`[WorkspaceSkills] Failed to load skill from ${skillFilePath}:`, error.message);
            }
          }
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if any skills path directory has been modified since last discovery.
   * Compares directory mtime to lastDiscoveryTime.
   * For glob patterns, checks the walk root and expanded directories.
   */
  async #isSkillsPathStale(): Promise<boolean> {
    if (this.#lastDiscoveryTime === 0) {
      // Never discovered, consider stale
      return true;
    }

    // Skip the expensive stat calls if discovery happened very recently
    // (e.g., right after a surgical addSkill/removeSkill). This avoids
    // a timing race where the filesystem write updates directory mtime
    // to the same second as #lastDiscoveryTime, and also avoids slow
    // stat calls to external mounts immediately after a known-good update.
    if (Date.now() - this.#lastDiscoveryTime < WorkspaceSkillsImpl.STALENESS_CHECK_COOLDOWN) {
      return false;
    }

    for (const skillsPath of this.#resolvedPaths) {
      let pathsToCheck: string[];

      if (isGlobPattern(skillsPath)) {
        // Use cached glob dirs, re-resolve periodically to discover new directories
        const now = Date.now();
        const lastResolved = this.#globResolveTimes.get(skillsPath) ?? 0;
        if (now - lastResolved > WorkspaceSkillsImpl.GLOB_RESOLVE_INTERVAL || !this.#globDirCache.has(skillsPath)) {
          const dirs = await this.#resolveGlobToDirectories(skillsPath);
          this.#globDirCache.set(skillsPath, dirs);
          this.#globResolveTimes.set(skillsPath, now);
        }
        pathsToCheck = this.#globDirCache.get(skillsPath) ?? [];
      } else {
        pathsToCheck = [skillsPath];
      }

      for (const pathToCheck of pathsToCheck) {
        try {
          const stat = await this.#source.stat(pathToCheck);
          const mtime = stat.modifiedAt.getTime();

          if (mtime > this.#lastDiscoveryTime) {
            return true;
          }

          // Skip subdirectory scan for non-directory paths (direct skill references)
          if (stat.type !== 'directory') {
            continue;
          }

          // Also check subdirectories (skill directories) for changes
          const entries = await this.#source.readdir(pathToCheck);
          for (const entry of entries) {
            if (entry.type !== 'directory') continue;

            const entryPath = this.#joinPath(pathToCheck, entry.name);
            try {
              const entryStat = await this.#source.stat(entryPath);
              if (entryStat.modifiedAt.getTime() > this.#lastDiscoveryTime) {
                return true;
              }
            } catch {
              // Couldn't stat entry, skip it
            }
          }
        } catch {
          // Couldn't stat path (doesn't exist or error), skip to next
          continue;
        }
      }
    }

    return false;
  }

  /**
   * Parse a SKILL.md file
   */
  async #parseSkillFile(filePath: string, dirName: string, source: ContentSource): Promise<InternalSkill> {
    const rawContent = await this.#source.readFile(filePath);
    const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');

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

    if (!(await this.#source.exists(subdirPath))) {
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
   * Walk a directory recursively and call callback for each file.
   * Limited to maxDepth (default 20) to prevent stack overflow on deep hierarchies.
   */
  async #walkDirectory(
    basePath: string,
    dirPath: string,
    callback: (relativePath: string) => void,
    depth: number = 0,
    maxDepth: number = 20,
  ): Promise<void> {
    if (depth >= maxDepth) {
      return;
    }

    const entries = await this.#source.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = this.#joinPath(dirPath, entry.name);

      if (entry.type === 'directory' && !entry.isSymlink) {
        await this.#walkDirectory(basePath, entryPath, callback, depth + 1, maxDepth);
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
        const rawContent = await this.#source.readFile(fullPath);
        const content = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8');
        parts.push(content);
      } catch {
        // Skip files that can't be read
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Remove a skill's entries from the search index.
   */
  async #removeSkillFromIndex(skill: InternalSkill): Promise<void> {
    if (!this.#searchEngine?.remove) return;

    const ids = [`skill:${skill.name}:SKILL.md`, ...skill.references.map(r => `skill:${skill.name}:${r}`)];
    for (const id of ids) {
      try {
        await this.#searchEngine.remove(id);
      } catch {
        // Best-effort removal; entry may already be gone
      }
    }
  }

  /**
   * Infer the ContentSource for a skill path by matching against resolved paths.
   */
  #inferSource(skillPath: string): ContentSource {
    for (const rp of this.#resolvedPaths) {
      if (skillPath === rp || skillPath.startsWith(rp + '/')) {
        return this.#determineSource(rp);
      }
    }
    return this.#determineSource(skillPath);
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
        const rawContent = await this.#source.readFile(fullPath);
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
          if (results.length >= topK) break;
          const content = await this.getReference(skill.name, `references/${refPath}`);
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
  #determineSource(skillsPath: string): ContentSource {
    // Use path segment matching to avoid false positives (e.g., my-node_modules)
    const segments = skillsPath.split('/');
    if (segments.includes('node_modules')) {
      return { type: 'external', packagePath: skillsPath };
    }
    if (skillsPath.includes('/.mastra/skills') || skillsPath.startsWith('.mastra/skills')) {
      return { type: 'managed', mastraPath: skillsPath };
    }
    return { type: 'local', projectPath: skillsPath };
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
   * Validate and normalize a relative path to prevent directory traversal.
   * Throws if the path contains traversal segments (..) or is absolute.
   */
  #assertRelativePath(input: string, label: string): string {
    const normalized = input.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(seg => Boolean(seg) && seg !== '.');
    if (normalized.startsWith('/') || segments.some(seg => seg === '..')) {
      throw new Error(`Invalid ${label} path: ${input}`);
    }
    return segments.join('/');
  }

  /**
   * Get parent path
   */
  #getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
  }
}
