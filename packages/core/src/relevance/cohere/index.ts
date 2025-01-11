import { CohereClient } from 'cohere-ai';

import { RelevanceScoreProvider } from '../relevance-score-provider';

// Cohere implementation
export class CohereRelevanceScorer implements RelevanceScoreProvider {
  private client: any;
  private model: string;
  constructor(apiKey: string, model?: string) {
    this.client = new CohereClient({
      token: apiKey,
    });

    this.model = model || 'rerank-v3.5';
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
