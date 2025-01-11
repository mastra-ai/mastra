// Provider interfaces
export interface RelevanceScoreProvider {
  getRelevanceScore(text1: string, text2: string): Promise<number>;
}

// Helper function used by providers
export function createSimilarityPrompt(query: string, text: string): string {
  return `Rate the semantic similarity between the following the query and the text on a scale from 0 to 1 (decimals allowed), where 1 means exactly the same meaning and 0 means completely different:

Query: ${query}

Text: ${text}

Relevance score (0-1):`;
}
