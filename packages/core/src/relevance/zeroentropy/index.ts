import type { RelevanceScoreProvider } from '../relevance-score-provider';

interface ZeroEntropyResult {
  index: number;
  relevance_score: number;
}

interface ZeroEntropyResponse {
  results: ZeroEntropyResult[];
}

export interface ZeroEntropyRelevanceResult {
  index: number;
  relevance_score: number;
}

// ZeroEntropy implementation
export class ZeroEntropyRelevanceScorer implements RelevanceScoreProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ZEROENTROPY_API_KEY || '';
  }

  async getRelevanceScore(query: string, text: string): Promise<number> {
    const results = await this.getRerankedDocuments(query, [text]);
    return results[0]?.relevance_score ?? 0;
  }

  async getRerankedDocuments(query: string, documents: string[]): Promise<ZeroEntropyRelevanceResult[]> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      query,
      documents,
    };

    const response = await fetch('https://api.zeroentropy.dev/v1/models/rerank', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`ZeroEntropy API error: ${response.status} ${response.statusText}`);
    }

    const data: ZeroEntropyResponse = await response.json();
    
    return data.results;
  }
}
