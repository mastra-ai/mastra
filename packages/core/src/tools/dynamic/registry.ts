import type { AnyTool, ToolRegistry, ToolRegistryEntry, ToolSearchResult } from './types';

/**
 * Tokenize text into searchable terms.
 * Splits on whitespace and special characters, lowercases, and filters short tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()[\]{}'"]+/)
    .filter(token => token.length > 1);
}

/**
 * BM25-inspired search scoring implementation.
 * This is a simplified version optimized for tool search without external dependencies.
 *
 * Key principles:
 * - Term frequency (TF): How often a query term appears in a document
 * - Inverse document frequency (IDF): Rarer terms are weighted higher
 * - Document length normalization: Longer descriptions don't unfairly score higher
 */
export class ToolRegistryImpl implements ToolRegistry {
  private entries: ToolRegistryEntry[] = [];

  // BM25 parameters
  private readonly k1 = 1.5; // Term frequency saturation
  private readonly b = 0.75; // Length normalization factor

  /**
   * Register a tool in the registry.
   * The tool's id and description are indexed for search.
   */
  register(tool: AnyTool): void {
    const name = tool.id;
    const description = tool.description || '';

    // Check for duplicates
    if (this.entries.some(e => e.name === name)) {
      // Update existing entry
      const idx = this.entries.findIndex(e => e.name === name);
      this.entries[idx] = {
        tool,
        name,
        description,
        tokens: tokenize(`${name} ${description}`),
      };
      return;
    }

    this.entries.push({
      tool,
      name,
      description,
      tokens: tokenize(`${name} ${description}`),
    });
  }

  /**
   * Calculate average document length across all entries
   */
  private getAverageDocLength(): number {
    if (this.entries.length === 0) return 0;
    const totalLength = this.entries.reduce((sum, entry) => sum + entry.tokens.length, 0);
    return totalLength / this.entries.length;
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term.
   * Rarer terms get higher scores.
   */
  private calculateIDF(term: string): number {
    const N = this.entries.length;
    const n = this.entries.filter(entry => entry.tokens.includes(term)).length;

    if (n === 0) return 0;

    // Standard IDF formula with smoothing
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }

  /**
   * Calculate BM25 score for a single term in a document
   */
  private calculateTermScore(term: string, entry: ToolRegistryEntry, avgDl: number): number {
    const tf = entry.tokens.filter(t => t === term).length;
    if (tf === 0) return 0;

    const idf = this.calculateIDF(term);
    const dl = entry.tokens.length;

    // BM25 formula
    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * (dl / avgDl));

    return idf * (numerator / denominator);
  }

  /**
   * Search for tools matching the query.
   *
   * @param query - Search keywords
   * @param topK - Maximum number of results to return (default: 5)
   * @param minScore - Minimum score threshold (default: 0)
   * @returns Array of matching tools with scores, sorted by relevance
   */
  search(query: string, topK = 5, minScore = 0): ToolSearchResult[] {
    if (this.entries.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const avgDl = this.getAverageDocLength();

    // Score each document
    const scored = this.entries.map(entry => {
      let score = 0;

      for (const term of queryTokens) {
        score += this.calculateTermScore(term, entry, avgDl);

        // Boost exact name matches significantly
        if (entry.name.toLowerCase() === term) {
          score += 5;
        } else if (entry.name.toLowerCase().includes(term)) {
          score += 2;
        }
      }

      return { entry, score };
    });

    // Filter, sort, and return top results
    return scored
      .filter(s => s.score > minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({
        name: s.entry.name,
        description: s.entry.description.length > 150 ? s.entry.description.slice(0, 147) + '...' : s.entry.description,
        score: Math.round(s.score * 100) / 100,
      }));
  }

  /**
   * Get a tool by its exact name
   */
  get(name: string): AnyTool | undefined {
    return this.entries.find(e => e.name === name)?.tool;
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return this.entries.map(e => e.name);
  }

  /**
   * Get the number of registered tools
   */
  size(): number {
    return this.entries.length;
  }
}

/**
 * Create a new tool registry instance
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistryImpl();
}
