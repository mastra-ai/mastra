/**
 * Types for Skills following the Agent Skills specification.
 * Skills are SKILL.md files discovered from workspace skills paths.
 *
 * @see https://github.com/anthropics/skills
 */

import type { RequestContext } from '../../request-context';
import type { LineRange } from '../line-utils';

// =============================================================================
// Content Source Types
// =============================================================================

/**
 * Source type identifier for content origin
 */
export type ContentSourceType = 'external' | 'local' | 'managed';

/**
 * Content source indicating where a skill comes from and its access level.
 *
 * - external: From node_modules packages (read-only)
 * - local: From project source directory (read-write)
 * - managed: From .mastra directory, typically Studio-managed (read-write)
 */
export type ContentSource =
  | { type: 'external'; packagePath: string }
  | { type: 'local'; projectPath: string }
  | { type: 'managed'; mastraPath: string };

/**
 * Check if a source is writable (not external/read-only)
 */
export function isWritableContentSource(source: ContentSource): boolean {
  return source.type !== 'external';
}

/**
 * Determine the source type for a given path.
 */
export function getSourceForPath(path: string): ContentSource {
  if (path.includes('node_modules')) {
    return { type: 'external', packagePath: path };
  } else if (path.includes('.mastra')) {
    return { type: 'managed', mastraPath: path };
  } else {
    return { type: 'local', projectPath: path };
  }
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * Search mode options
 */
export type SearchMode = 'vector' | 'bm25' | 'hybrid';

/**
 * Score breakdown for hybrid search
 */
export interface ScoreDetails {
  /** Vector similarity score (0-1) */
  vector?: number;
  /** BM25 relevance score */
  bm25?: number;
}

/**
 * Base search result with common fields.
 */
export interface BaseSearchResult {
  /** Content that was matched */
  content: string;
  /** Relevance score (higher is more relevant) */
  score: number;
  /** Line range where query terms were found (if available) */
  lineRange?: LineRange;
  /** Score breakdown for hybrid search */
  scoreDetails?: ScoreDetails;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base search options with common fields.
 */
export interface BaseSearchOptions {
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Search mode */
  mode?: SearchMode;
  /** Hybrid search configuration */
  hybrid?: {
    /** Weight for vector similarity score (0-1) */
    vectorWeight?: number;
  };
}

// =============================================================================
// Skills Types
// =============================================================================

/**
 * Context passed to skills resolver function.
 * Contains request-scoped information for dynamic path resolution.
 */
export interface SkillsContext {
  /** Request context with user/thread information */
  requestContext?: RequestContext;
}

/**
 * Resolver for skills - can be static array of paths or dynamic function.
 *
 * Static: A fixed array of paths to scan for skills.
 * Dynamic: A function that returns paths based on context (e.g., user tier, tenant).
 *
 * @example Static paths
 * ```typescript
 * const workspace = new Workspace({
 *   skills: ['/skills', '/node_modules/@myorg/skills'],
 * });
 * ```
 *
 * @example Dynamic paths based on user tier
 * ```typescript
 * const workspace = new Workspace({
 *   skills: (ctx) => {
 *     const tier = ctx.requestContext?.get('userTier');
 *     if (tier === 'premium') {
 *       return ['/skills/basic', '/skills/premium'];
 *     }
 *     return ['/skills/basic'];
 *   },
 * });
 * ```
 */
export type SkillsResolver = string[] | ((context: SkillsContext) => string[] | Promise<string[]>);

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
}

/**
 * Full skill with parsed instructions and path info
 */
export interface Skill extends SkillMetadata {
  /** Path to skill directory (relative to workspace root) */
  path: string;
  /** Markdown body from SKILL.md */
  instructions: string;
  /** Source of the skill (external package, local project, or managed) */
  source: ContentSource;
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

// =============================================================================
// WorkspaceSkills Interface
// =============================================================================

/**
 * Interface for skills accessed via workspace.skills.
 * Provides discovery, search, and CRUD operations for skills in the workspace.
 *
 * Skills are SKILL.md files discovered from configured skills.
 * All operations are async because they use the workspace filesystem.
 *
 * @example
 * ```typescript
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './data' }),
 *   skills: ['/skills'],
 * });
 *
 * // List all skills
 * const skills = await workspace.skills.list();
 *
 * // Get a specific skill
 * const skill = await workspace.skills.get('brand-guidelines');
 *
 * // Search skills
 * const results = await workspace.skills.search('color palette');
 * ```
 */
export interface WorkspaceSkills {
  // ===========================================================================
  // Properties
  // ===========================================================================

  /**
   * Whether this skills instance supports write operations (create/update/delete).
   * Returns false when using a read-only source like LocalSkillSource.
   */
  readonly isWritable: boolean;

  // ===========================================================================
  // Discovery
  // ===========================================================================

  /**
   * List all discovered skills (metadata only)
   */
  list(): Promise<SkillMetadata[]>;

  /**
   * Get a specific skill by name (full content)
   */
  get(name: string): Promise<Skill | null>;

  /**
   * Check if a skill exists
   */
  has(name: string): Promise<boolean>;

  /**
   * Refresh skills from filesystem (re-scan skills)
   */
  refresh(): Promise<void>;

  /**
   * Conditionally refresh skills if the skills have been modified.
   * Uses a staleness check to avoid unnecessary re-discovery on every call.
   *
   * When skills is a dynamic function, pass context to resolve paths.
   * If paths have changed, triggers a full refresh.
   *
   * Call this in processInput before each agent turn to catch newly
   * added skills without the overhead of a full refresh every time.
   *
   * @param context - Optional context for dynamic path resolution
   */
  maybeRefresh(context?: SkillsContext): Promise<void>;

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search across all skills content.
   * Uses workspace's search engine (BM25, vector, or hybrid).
   */
  search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>;

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new skill.
   * Creates a skill directory with SKILL.md and optional reference/script/asset files.
   *
   * @param input - Skill creation input
   * @throws Error if skill already exists or validation fails
   */
  create(input: CreateSkillInput): Promise<Skill>;

  /**
   * Update an existing skill.
   *
   * @param name - Name of the skill to update
   * @param input - Update input (partial metadata and/or instructions)
   * @throws Error if skill doesn't exist
   */
  update(name: string, input: UpdateSkillInput): Promise<Skill>;

  /**
   * Delete a skill.
   *
   * @param name - Name of the skill to delete
   * @throws Error if skill doesn't exist
   */
  delete(name: string): Promise<void>;

  // ===========================================================================
  // Single-item Accessors
  // ===========================================================================

  /**
   * Get reference file content from a skill
   */
  getReference(skillName: string, referencePath: string): Promise<string | null>;

  /**
   * Get script file content from a skill
   */
  getScript(skillName: string, scriptPath: string): Promise<string | null>;

  /**
   * Get asset file content from a skill (returns Buffer for binary files)
   */
  getAsset(skillName: string, assetPath: string): Promise<Buffer | null>;

  // ===========================================================================
  // Listing Accessors
  // ===========================================================================

  /**
   * Get all reference file paths for a skill
   */
  listReferences(skillName: string): Promise<string[]>;

  /**
   * Get all script file paths for a skill
   */
  listScripts(skillName: string): Promise<string[]>;

  /**
   * Get all asset file paths for a skill
   */
  listAssets(skillName: string): Promise<string[]>;
}
