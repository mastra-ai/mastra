/**
 * BM25 (Best Matching 25) implementation for keyword-based search.
 *
 * BM25 is a probabilistic ranking function used for information retrieval.
 * It ranks documents based on the query terms appearing in each document,
 * taking into account term frequency and document length normalization.
 */

import type { LineRange } from '@mastra/core/artifacts';

// Re-export LineRange for consumers who import from bm25
export type { LineRange };

/**
 * BM25 configuration parameters
 */
export interface BM25Config {
  /**
   * Controls term frequency saturation.
   * Higher values give more weight to term frequency.
   * Typical range: 1.2 - 2.0
   * @default 1.5
   */
  k1?: number;

  /**
   * Controls document length normalization.
   * 0 = no length normalization, 1 = full normalization
   * @default 0.75
   */
  b?: number;
}

/**
 * Represents a document in the BM25 index
 */
export interface BM25Document {
  /** Document identifier */
  id: string;
  /** Document content */
  content: string;
  /** Pre-computed tokens for the document */
  tokens: string[];
  /** Token frequency map */
  termFrequencies: Map<string, number>;
  /** Total number of tokens */
  length: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from a BM25 search
 */
export interface BM25SearchResult {
  /** Document identifier */
  id: string;
  /** Document content */
  content: string;
  /** BM25 score (higher is more relevant) */
  score: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Line range where query terms were found (if computed) */
  lineRange?: LineRange;
}

/**
 * Tokenization options
 */
export interface TokenizeOptions {
  /** Convert to lowercase */
  lowercase?: boolean;
  /** Remove punctuation */
  removePunctuation?: boolean;
  /** Minimum token length */
  minLength?: number;
  /** Custom stopwords to remove */
  stopwords?: Set<string>;
}

/**
 * Default English stopwords
 */
export const DEFAULT_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
]);

/**
 * Default tokenization options
 */
const DEFAULT_TOKENIZE_OPTIONS: Required<TokenizeOptions> = {
  lowercase: true,
  removePunctuation: true,
  minLength: 2,
  stopwords: DEFAULT_STOPWORDS,
};

/**
 * Tokenize text into an array of terms
 */
export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  const opts = { ...DEFAULT_TOKENIZE_OPTIONS, ...options };

  let processed = text;

  // Convert to lowercase if enabled
  if (opts.lowercase) {
    processed = processed.toLowerCase();
  }

  // Remove punctuation if enabled
  if (opts.removePunctuation) {
    processed = processed.replace(/[^\w\s]/g, ' ');
  }

  // Split into tokens
  const tokens = processed.split(/\s+/).filter(token => {
    // Filter by minimum length
    if (token.length < opts.minLength) {
      return false;
    }
    // Filter stopwords
    if (opts.stopwords?.has(token)) {
      return false;
    }
    return true;
  });

  return tokens;
}

/**
 * Find the line range where query terms appear in content.
 * Returns the range spanning from the first to the last line containing any query term.
 *
 * @param content - The document content
 * @param queryTerms - Tokenized query terms to find
 * @param options - Tokenization options (should match indexing options)
 * @returns LineRange if terms found, undefined otherwise
 */
export function findLineRange(
  content: string,
  queryTerms: string[],
  options: TokenizeOptions = {},
): LineRange | undefined {
  if (queryTerms.length === 0) return undefined;

  const lines = content.split('\n');
  const opts = { ...DEFAULT_TOKENIZE_OPTIONS, ...options };

  // Normalize query terms for matching
  const normalizedTerms = new Set(queryTerms.map(t => (opts.lowercase ? t.toLowerCase() : t)));

  let firstMatchLine: number | undefined;
  let lastMatchLine: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const lineTokens = tokenize(lines[i]!, options);

    // Check if any query term appears in this line
    for (const token of lineTokens) {
      if (normalizedTerms.has(token)) {
        const lineNum = i + 1; // 1-indexed
        if (firstMatchLine === undefined) {
          firstMatchLine = lineNum;
        }
        lastMatchLine = lineNum;
        break; // Found a match on this line, move to next line
      }
    }
  }

  if (firstMatchLine !== undefined && lastMatchLine !== undefined) {
    return { start: firstMatchLine, end: lastMatchLine };
  }

  return undefined;
}

/**
 * Extract lines from content by line range.
 *
 * @param content - The document content
 * @param startLine - Starting line number (1-indexed)
 * @param endLine - Ending line number (1-indexed, inclusive)
 * @returns Object with extracted content and metadata
 */
export function extractLines(
  content: string,
  startLine?: number,
  endLine?: number,
): {
  content: string;
  lines: { start: number; end: number };
  totalLines: number;
} {
  const allLines = content.split('\n');
  const totalLines = allLines.length;

  // Default to full content
  const start = Math.max(1, startLine ?? 1);
  const end = Math.min(totalLines, endLine ?? totalLines);

  // Extract the requested range (convert to 0-indexed)
  const extractedLines = allLines.slice(start - 1, end);

  return {
    content: extractedLines.join('\n'),
    lines: { start, end },
    totalLines,
  };
}

/**
 * Convert a character index to a line number.
 * Useful for converting RAG chunk character offsets to line numbers.
 *
 * @param content - The full document content
 * @param charIndex - The character index (0-indexed)
 * @returns The line number (1-indexed), or undefined if charIndex is out of bounds
 */
export function charIndexToLineNumber(content: string, charIndex: number): number | undefined {
  if (charIndex < 0 || charIndex > content.length) {
    return undefined;
  }

  // Count newlines before the character index
  let lineNumber = 1;
  for (let i = 0; i < charIndex && i < content.length; i++) {
    if (content[i] === '\n') {
      lineNumber++;
    }
  }

  return lineNumber;
}

/**
 * Convert character range to line range.
 * Useful for converting RAG chunk character offsets to line ranges.
 *
 * @param content - The full document content
 * @param startCharIdx - Start character index (0-indexed)
 * @param endCharIdx - End character index (0-indexed, exclusive)
 * @returns LineRange (1-indexed) or undefined if indices are out of bounds
 */
export function charRangeToLineRange(content: string, startCharIdx: number, endCharIdx: number): LineRange | undefined {
  const startLine = charIndexToLineNumber(content, startCharIdx);
  // For end, we want the line containing the last character (endCharIdx - 1)
  const endLine = charIndexToLineNumber(content, Math.max(0, endCharIdx - 1));

  if (startLine === undefined || endLine === undefined) {
    return undefined;
  }

  return { start: startLine, end: endLine };
}

/**
 * Compute term frequencies for a list of tokens
 */
function computeTermFrequencies(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }
  return frequencies;
}

/**
 * BM25 Index for keyword-based document retrieval
 */
export class BM25Index {
  /** BM25 k1 parameter */
  readonly k1: number;
  /** BM25 b parameter */
  readonly b: number;

  /** Documents in the index */
  #documents: Map<string, BM25Document> = new Map();
  /** Inverted index: term -> document IDs containing the term */
  #invertedIndex: Map<string, Set<string>> = new Map();
  /** Document frequency: term -> number of documents containing the term */
  #documentFrequency: Map<string, number> = new Map();
  /** Average document length */
  #avgDocLength: number = 0;
  /** Total number of documents */
  #docCount: number = 0;
  /** Tokenization options */
  #tokenizeOptions: TokenizeOptions;

  constructor(config: BM25Config = {}, tokenizeOptions: TokenizeOptions = {}) {
    this.k1 = config.k1 ?? 1.5;
    this.b = config.b ?? 0.75;
    this.#tokenizeOptions = tokenizeOptions;
  }

  /**
   * Add a document to the index
   */
  add(id: string, content: string, metadata?: Record<string, unknown>): void {
    // Remove existing document if it exists
    if (this.#documents.has(id)) {
      this.remove(id);
    }

    const tokens = tokenize(content, this.#tokenizeOptions);
    const termFrequencies = computeTermFrequencies(tokens);

    const doc: BM25Document = {
      id,
      content,
      tokens,
      termFrequencies,
      length: tokens.length,
      metadata,
    };

    this.#documents.set(id, doc);
    this.#docCount++;

    // Update inverted index and document frequency
    for (const term of termFrequencies.keys()) {
      if (!this.#invertedIndex.has(term)) {
        this.#invertedIndex.set(term, new Set());
      }
      this.#invertedIndex.get(term)!.add(id);
      this.#documentFrequency.set(term, (this.#documentFrequency.get(term) || 0) + 1);
    }

    // Update average document length
    this.#updateAvgDocLength();
  }

  /**
   * Remove a document from the index
   */
  remove(id: string): boolean {
    const doc = this.#documents.get(id);
    if (!doc) {
      return false;
    }

    // Update inverted index and document frequency
    for (const term of doc.termFrequencies.keys()) {
      const docIds = this.#invertedIndex.get(term);
      if (docIds) {
        docIds.delete(id);
        if (docIds.size === 0) {
          this.#invertedIndex.delete(term);
          this.#documentFrequency.delete(term);
        } else {
          this.#documentFrequency.set(term, (this.#documentFrequency.get(term) || 1) - 1);
        }
      }
    }

    this.#documents.delete(id);
    this.#docCount--;

    // Update average document length
    this.#updateAvgDocLength();

    return true;
  }

  /**
   * Clear all documents from the index
   */
  clear(): void {
    this.#documents.clear();
    this.#invertedIndex.clear();
    this.#documentFrequency.clear();
    this.#docCount = 0;
    this.#avgDocLength = 0;
  }

  /**
   * Search for documents matching the query
   */
  search(query: string, topK: number = 10, minScore: number = 0): BM25SearchResult[] {
    const queryTokens = tokenize(query, this.#tokenizeOptions);

    if (queryTokens.length === 0 || this.#docCount === 0) {
      return [];
    }

    const scores = new Map<string, number>();

    // Calculate BM25 scores for each document
    for (const queryTerm of queryTokens) {
      const docIds = this.#invertedIndex.get(queryTerm);
      if (!docIds) {
        continue;
      }

      const df = this.#documentFrequency.get(queryTerm) || 0;
      const idf = this.#computeIDF(df);

      for (const docId of docIds) {
        const doc = this.#documents.get(docId)!;
        const tf = doc.termFrequencies.get(queryTerm) || 0;
        const termScore = this.#computeTermScore(tf, doc.length, idf);

        scores.set(docId, (scores.get(docId) || 0) + termScore);
      }
    }

    // Sort by score and return top K results
    const results: BM25SearchResult[] = [];

    for (const [docId, score] of scores.entries()) {
      if (score >= minScore) {
        const doc = this.#documents.get(docId)!;
        results.push({
          id: docId,
          content: doc.content,
          score,
          metadata: doc.metadata,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Get a document by ID
   */
  get(id: string): BM25Document | undefined {
    return this.#documents.get(id);
  }

  /**
   * Check if a document exists in the index
   */
  has(id: string): boolean {
    return this.#documents.has(id);
  }

  /**
   * Get the number of documents in the index
   */
  get size(): number {
    return this.#docCount;
  }

  /**
   * Get all document IDs
   */
  get documentIds(): string[] {
    return Array.from(this.#documents.keys());
  }

  /**
   * Serialize the index to a JSON-compatible object
   */
  serialize(): BM25IndexData {
    const documents: SerializedBM25Document[] = [];
    for (const [id, doc] of this.#documents.entries()) {
      documents.push({
        id,
        content: doc.content,
        tokens: doc.tokens,
        termFrequencies: Object.fromEntries(doc.termFrequencies),
        length: doc.length,
        metadata: doc.metadata,
      });
    }

    return {
      k1: this.k1,
      b: this.b,
      documents,
      avgDocLength: this.#avgDocLength,
    };
  }

  /**
   * Deserialize an index from a JSON object
   */
  static deserialize(data: BM25IndexData, tokenizeOptions: TokenizeOptions = {}): BM25Index {
    const index = new BM25Index({ k1: data.k1, b: data.b }, tokenizeOptions);

    for (const doc of data.documents) {
      const termFrequencies = new Map(Object.entries(doc.termFrequencies));

      const document: BM25Document = {
        id: doc.id,
        content: doc.content,
        tokens: doc.tokens,
        termFrequencies,
        length: doc.length,
        metadata: doc.metadata,
      };

      index.#documents.set(doc.id, document);
      index.#docCount++;

      // Rebuild inverted index and document frequency
      for (const term of termFrequencies.keys()) {
        if (!index.#invertedIndex.has(term)) {
          index.#invertedIndex.set(term, new Set());
        }
        index.#invertedIndex.get(term)!.add(doc.id);
        index.#documentFrequency.set(term, (index.#documentFrequency.get(term) || 0) + 1);
      }
    }

    index.#avgDocLength = data.avgDocLength;

    return index;
  }

  /**
   * Update average document length after add/remove operations
   */
  #updateAvgDocLength(): void {
    if (this.#docCount === 0) {
      this.#avgDocLength = 0;
      return;
    }

    let totalLength = 0;
    for (const doc of this.#documents.values()) {
      totalLength += doc.length;
    }
    this.#avgDocLength = totalLength / this.#docCount;
  }

  /**
   * Compute IDF (Inverse Document Frequency) for a term
   */
  #computeIDF(df: number): number {
    // Using Robertson-Spärck Jones IDF formula
    return Math.log((this.#docCount - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Compute the BM25 score component for a single term
   */
  #computeTermScore(tf: number, docLength: number, idf: number): number {
    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / this.#avgDocLength));
    return idf * (numerator / denominator);
  }
}

/**
 * Serialized document format for persistence
 */
interface SerializedBM25Document {
  id: string;
  content: string;
  tokens: string[];
  termFrequencies: Record<string, number>;
  length: number;
  metadata?: Record<string, unknown>;
}

/**
 * Serialized index data for persistence
 */
export interface BM25IndexData {
  k1: number;
  b: number;
  documents: SerializedBM25Document[];
  avgDocLength: number;
}
