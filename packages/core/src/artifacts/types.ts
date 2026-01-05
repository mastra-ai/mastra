/**
 * Shared types for content storage and search (Skills & Knowledge)
 */

// ============================================================================
// Source Types
// ============================================================================

/**
 * Source type identifier for content origin
 */
export type ContentSourceType = 'external' | 'local' | 'managed';

/**
 * Content source indicating where content comes from and its access level.
 * Used by both Skills and Knowledge to track read-only vs read-write sources.
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
 * Options for listing content entities (skills or namespaces)
 */
export interface ListContentOptions {
  /** Only include entities from specific source types */
  sourceTypes?: ContentSourceType[];
}

// ============================================================================
// Source Utilities
// ============================================================================

/**
 * Check if a source is writable (not external/read-only)
 */
export function isWritableSource(source: ContentSource): boolean {
  return source.type !== 'external';
}

/**
 * Determine the source type for a given path.
 * Uses heuristics based on common path patterns.
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

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search mode options
 */
export type SearchMode = 'vector' | 'bm25' | 'hybrid';

/**
 * Line range where content was found
 */
export interface LineRange {
  /** Starting line number (1-indexed) */
  start: number;
  /** Ending line number (1-indexed, inclusive) */
  end: number;
}

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
 * Domain-specific results (SkillSearchResult, KnowledgeSearchResult) extend this.
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
 * Domain-specific options extend this with additional filters.
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
