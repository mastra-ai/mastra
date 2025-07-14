import type { RelevanceScoreProvider } from '@mastra/core/relevance';

interface CohereRerankingResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
  id: string;
  meta: {
    api_version: {
      version: string;
      is_experimental: boolean;
    };
    billed_units: {
      search_units: number;
    };
  };
}

export class CohereRelevanceScorer implements RelevanceScoreProvider {
  private model: string;
  private apiKey?: string;
  constructor(model: string, apiKey?: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async getRelevanceScore(query: string, text: string): Promise<number> {
    const response = await fetch(`https://api.cohere.com/v2/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        documents: [text],
        model: this.model,
        top_n: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as CohereRerankingResponse;
    const relevanceScore = data.results[0]?.relevance_score;

    if (!relevanceScore) {
      throw new Error('No relevance score found on Cohere response');
    }

    return relevanceScore;
  }
}
