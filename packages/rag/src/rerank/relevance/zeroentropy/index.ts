import type { RelevanceScoreProvider } from '@mastra/core/relevance';
import ZeroEntropy from 'zeroentropy';

// ZeroEntropy implementation
export class ZeroEntropyRelevanceScorer implements RelevanceScoreProvider {
  private client: ZeroEntropy;
  private model: string;

  constructor(model?: string, apiKey?: string) {
    this.client = new ZeroEntropy({
      apiKey: apiKey || process.env.ZEROENTROPY_API_KEY || '',
    });
    this.model = model || 'zerank-1';
  }

  async getRelevanceScore(query: string, text: string): Promise<number> {
    const response = await this.client.models.rerank({
      query,
      documents: [text],
      model: this.model,
      top_n: 1,
    });

    return response.results[0]?.relevance_score ?? 0;
  }
}
