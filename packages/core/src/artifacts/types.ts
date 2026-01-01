/**
 * Shared types for content storage and search (Skills & Knowledge)
 */

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
