/**
 * Types for the Skills primitive following the Agent Skills specification.
 * @see https://github.com/anthropics/skills
 */

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
 * Skill source types indicating where the skill comes from and its access level
 */
export type SkillSource =
  | { type: 'external'; packagePath: string } // node_modules - read-only
  | { type: 'local'; projectPath: string } // ./src/skills - read-write
  | { type: 'managed'; mastraPath: string }; // .mastra/skills - read-write (Studio-managed)

/**
 * Search result when searching across skills
 */
export interface SkillSearchResult {
  /** Skill name */
  skillName: string;
  /** Source file (SKILL.md or reference path) */
  source: string;
  /** Matched content */
  content: string;
  /** Relevance score */
  score: number;
  /** Line number range (if available) */
  lineRange?: {
    start: number;
    end: number;
  };
  /** Score breakdown for hybrid search */
  scoreDetails?: {
    /** Vector similarity score (0-1) */
    vector?: number;
    /** BM25 relevance score */
    bm25?: number;
  };
}

/**
 * Search mode for skill queries
 */
export type SkillSearchMode = 'vector' | 'bm25' | 'hybrid';

/**
 * Options for searching skills
 */
export interface SkillSearchOptions {
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Only search within specific skill names */
  skillNames?: string[];
  /** Include reference files in search (default: true) */
  includeReferences?: boolean;
  /**
   * Search mode to use:
   * - 'vector': Semantic similarity search using embeddings
   * - 'bm25': Keyword-based search using BM25 algorithm
   * - 'hybrid': Combine both vector and BM25 scores
   *
   * If not specified, auto-detects based on configuration.
   */
  mode?: SkillSearchMode;
  /** Hybrid search configuration (only applies when mode is 'hybrid') */
  hybrid?: {
    /** Weight for vector similarity score (0-1). BM25 weight is (1 - vectorWeight). @default 0.5 */
    vectorWeight?: number;
  };
}

/**
 * Base interface for Skills instances that can be registered with Mastra.
 * The actual Skills class in @mastra/skills implements this interface.
 *
 * Skills manages discovery, parsing, and search of skills following the Agent Skills spec.
 */
export interface MastraSkills {
  /** Unique identifier for this skills instance */
  id: string;

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

  /**
   * Get reference file content from a skill
   */
  getReference(skillName: string, referencePath: string): string | undefined;

  /**
   * Get all reference file paths for a skill
   */
  getReferences(skillName: string): string[];

  /**
   * Get script file content from a skill
   */
  getScript(skillName: string, scriptPath: string): string | undefined;

  /**
   * Get all script file paths for a skill
   */
  getScripts(skillName: string): string[];

  /**
   * Get asset file content from a skill (returns Buffer for binary files)
   */
  getAsset(skillName: string, assetPath: string): Buffer | undefined;

  /**
   * Get all asset file paths for a skill
   */
  getAssets(skillName: string): string[];

  /**
   * Refresh skills from disk (re-scan directories)
   */
  refresh(): void;
}
