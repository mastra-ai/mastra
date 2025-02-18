import { CohereClient } from 'cohere-ai';

import type { RelevanceScoreProvider } from '../relevance-score-provider';

// Cohere implementation
export class CohereRelevanceScorer implements RelevanceScoreProvider {
  private client: any;
  private model: string;
  constructor(model: string, apiKey?: string) {
    this.client = new CohereClient({
      token: apiKey || process.env.COHERE_API_KEY || '',
    });

    this.model = model;
  }

  async getRelevanceScore(query: string, text: string): Promise<number> {
    const response = await this.client.rerank({
      query,
      documents: [text],
      model: this.model,
      topN: 1,
    });

    return response.results[0].relevanceScore;
  }
}
