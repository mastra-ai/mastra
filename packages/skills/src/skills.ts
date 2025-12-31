import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { MastraVector } from '@mastra/core/vector';
import matter from 'gray-matter';

import { BM25Index, tokenize, findLineRange } from './bm25';
import type { BM25Config, TokenizeOptions } from './bm25';
import { validateSkillMetadata, parseAllowedTools } from './schemas';
import type {
  Skill,
  SkillMetadata,
  SkillSource,
  SkillsConfig,
  SkillSearchResult,
  SkillSearchOptions,
  SkillSearchMode,
  MastraSkills,
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
 * Embedder interface - any function that takes text and returns embeddings
 */
export interface Embedder {
  (text: string): Promise<number[]>;
}

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

  /** Tokenization options for BM25 (stored for line range finding) */
  #tokenizeOptions?: TokenizeOptions;

  /** Vector index configuration (optional) */
  #indexConfig?: SkillsIndexConfig;

  /** Vector index name */
  #vectorIndexName?: string;

  /** Whether vector indexing has been done */
  #vectorIndexed: boolean = false;

  constructor(
    config: SkillsConfig,
    options?: {
      bm25?: SkillsBM25Config;
      index?: SkillsIndexConfig;
    },
  ) {
    this.id = config.id;
    this.paths = Array.isArray(config.paths) ? config.paths : [config.paths];
    this.validateOnLoad = config.validateOnLoad ?? true;

    // Initialize BM25 index and store tokenize options
    this.#tokenizeOptions = options?.bm25?.tokenize;
    this.#bm25Index = new BM25Index(options?.bm25?.bm25, this.#tokenizeOptions);

    // Store index config if provided
    if (options?.index) {
      this.#indexConfig = options.index;
      this.#vectorIndexName = options.index.indexName ?? `skills_${this.id.replace(/-/g, '_')}`;
    }

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
  search(query: string, options: SkillSearchOptions = {}): SkillSearchResult[] | Promise<SkillSearchResult[]> {
    const { topK = 5, minScore, skillNames, includeReferences = true, mode, hybrid } = options;

    // Determine the effective search mode
    const effectiveMode = this.#determineSearchMode(mode);

    if (effectiveMode === 'bm25') {
      return this.#searchBM25(query, topK, minScore, skillNames, includeReferences);
    }

    if (effectiveMode === 'vector') {
      return this.#searchVector(query, topK, minScore, skillNames, includeReferences);
    }

    // Hybrid search
    return this.#searchHybrid(query, topK, minScore, skillNames, includeReferences, hybrid?.vectorWeight ?? 0.5);
  }

  /**
   * Determine the effective search mode based on configuration
   */
  #determineSearchMode(requestedMode?: SkillSearchMode): SkillSearchMode {
    const canVector = !!this.#indexConfig;

    if (requestedMode) {
      if (requestedMode === 'vector' && !canVector) {
        throw new Error('Vector search requires index configuration. Provide index config when creating Skills.');
      }
      if (requestedMode === 'hybrid' && !canVector) {
        throw new Error('Hybrid search requires index configuration. Provide index config when creating Skills.');
      }
      return requestedMode;
    }

    // Auto-determine mode based on available configuration
    if (canVector) {
      return 'hybrid'; // Default to hybrid when vector is available
    }
    return 'bm25';
  }

  /**
   * BM25 keyword search
   */
  #searchBM25(
    query: string,
    topK: number,
    minScore?: number,
    skillNames?: string[],
    includeReferences: boolean = true,
  ): SkillSearchResult[] {
    // Get more results than needed to filter
    const expandedTopK = skillNames ? topK * 3 : topK;
    const bm25Results = this.#bm25Index.search(query, expandedTopK, minScore);

    // Tokenize query once for line range finding
    const queryTokens = tokenize(query, this.#tokenizeOptions);

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

      // Find line range where query terms appear
      const lineRange = findLineRange(result.content, queryTokens, this.#tokenizeOptions);

      results.push({
        skillName: metadata.skillName,
        source: metadata.source,
        content: result.content,
        score: result.score,
        lineRange,
        scoreDetails: { bm25: result.score },
      });

      if (results.length >= topK) break;
    }

    return results;
  }

  /**
   * Vector semantic search
   */
  async #searchVector(
    query: string,
    topK: number,
    minScore?: number,
    skillNames?: string[],
    includeReferences: boolean = true,
  ): Promise<SkillSearchResult[]> {
    if (!this.#indexConfig || !this.#vectorIndexName) {
      throw new Error('Vector search requires index configuration.');
    }

    // Ensure vector index is built
    await this.#ensureVectorIndex();

    const { vectorStore, embedder } = this.#indexConfig;

    // Generate embedding for the query
    const queryEmbedding = await embedder(query);

    // Get more results to allow for filtering
    const expandedTopK = skillNames ? topK * 3 : topK;

    // Query the vector store
    const vectorResults = await vectorStore.query({
      indexName: this.#vectorIndexName,
      queryVector: queryEmbedding,
      topK: expandedTopK,
    });

    // Tokenize query for line range finding
    const queryTokens = tokenize(query, this.#tokenizeOptions);

    const results: SkillSearchResult[] = [];

    for (const result of vectorResults) {
      // Skip results below minimum score
      if (minScore !== undefined && result.score < minScore) {
        continue;
      }

      const skillName = result.metadata?.skillName as string;
      const source = result.metadata?.source as string;
      const content = result.metadata?.text as string;

      if (!skillName || !source || !content) continue;

      // Filter by skill names if specified
      if (skillNames && !skillNames.includes(skillName)) {
        continue;
      }

      // Filter out references if not included
      if (!includeReferences && source !== 'SKILL.md') {
        continue;
      }

      // Find line range where query terms appear
      const lineRange = findLineRange(content, queryTokens, this.#tokenizeOptions);

      results.push({
        skillName,
        source,
        content,
        score: result.score,
        lineRange,
        scoreDetails: { vector: result.score },
      });

      if (results.length >= topK) break;
    }

    return results;
  }

  /**
   * Hybrid search combining vector and BM25 scores
   */
  async #searchHybrid(
    query: string,
    topK: number,
    minScore?: number,
    skillNames?: string[],
    includeReferences: boolean = true,
    vectorWeight: number = 0.5,
  ): Promise<SkillSearchResult[]> {
    // Get more results than requested to account for merging
    const expandedTopK = Math.min(topK * 2, 50);

    // Perform both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.#searchVector(query, expandedTopK, undefined, skillNames, includeReferences),
      Promise.resolve(this.#searchBM25(query, expandedTopK, undefined, skillNames, includeReferences)),
    ]);

    // Normalize BM25 scores to 0-1 range for fair combination
    const normalizedBM25 = this.#normalizeBM25Scores(bm25Results);

    // Create score maps by unique key (skillName:source)
    const bm25ScoreMap = new Map<string, SkillSearchResult>();
    for (const result of normalizedBM25) {
      const key = `${result.skillName}:${result.source}`;
      bm25ScoreMap.set(key, result);
    }

    const vectorScoreMap = new Map<string, SkillSearchResult>();
    for (const result of vectorResults) {
      const key = `${result.skillName}:${result.source}`;
      vectorScoreMap.set(key, result);
    }

    // Combine scores from both search methods
    const combinedResults = new Map<string, SkillSearchResult>();
    const allKeys = new Set([...vectorScoreMap.keys(), ...bm25ScoreMap.keys()]);

    const bm25Weight = 1 - vectorWeight;

    for (const key of allKeys) {
      const vectorResult = vectorScoreMap.get(key);
      const bm25Result = bm25ScoreMap.get(key);

      const vectorScore = vectorResult?.scoreDetails?.vector ?? 0;
      const bm25Score = bm25Result?.score ?? 0; // Already normalized

      // Weighted combination of scores
      const combinedScore = vectorWeight * vectorScore + bm25Weight * bm25Score;

      // Use data from whichever source has it
      const baseResult = vectorResult ?? bm25Result!;

      combinedResults.set(key, {
        skillName: baseResult.skillName,
        source: baseResult.source,
        content: baseResult.content,
        score: combinedScore,
        scoreDetails: {
          vector: vectorResult?.scoreDetails?.vector,
          bm25: bm25Result?.scoreDetails?.bm25,
        },
      });
    }

    // Sort by combined score and apply filters
    let results = Array.from(combinedResults.values());
    results.sort((a, b) => b.score - a.score);

    // Apply minScore filter
    if (minScore !== undefined) {
      results = results.filter(r => r.score >= minScore);
    }

    return results.slice(0, topK);
  }

  /**
   * Normalize BM25 scores to 0-1 range using min-max normalization
   */
  #normalizeBM25Scores(results: SkillSearchResult[]): SkillSearchResult[] {
    if (results.length === 0) return results;

    const scores = results.map(r => r.scoreDetails?.bm25 ?? r.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore;

    if (range === 0) {
      // All scores are the same, normalize to 1
      return results.map(r => ({ ...r, score: 1 }));
    }

    return results.map(r => ({
      ...r,
      score: ((r.scoreDetails?.bm25 ?? r.score) - minScore) / range,
    }));
  }

  /**
   * Ensure vector index is built (lazy indexing)
   */
  async #ensureVectorIndex(): Promise<void> {
    if (this.#vectorIndexed || !this.#indexConfig || !this.#vectorIndexName) {
      return;
    }

    const { vectorStore, embedder } = this.#indexConfig;

    // Index all skills
    for (const skill of this.#skills.values()) {
      // Index the main skill instructions
      const instructionEmbedding = await embedder(skill.instructions);
      await vectorStore.upsert({
        indexName: this.#vectorIndexName,
        vectors: [instructionEmbedding],
        metadata: [
          {
            skillName: skill.name,
            source: 'SKILL.md',
            text: skill.instructions,
          },
        ],
        ids: [`${skill.name}:SKILL.md`],
      });

      // Index each reference file
      for (const refPath of skill.references) {
        const fullPath = join(skill.path, 'references', refPath);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const refEmbedding = await embedder(content);
          await vectorStore.upsert({
            indexName: this.#vectorIndexName,
            vectors: [refEmbedding],
            metadata: [
              {
                skillName: skill.name,
                source: `references/${refPath}`,
                text: content,
              },
            ],
            ids: [`${skill.name}:${refPath}`],
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }

    this.#vectorIndexed = true;
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
