import { AgentCompletionProvider, CohereCompletionProvider, CompletionProvider } from '@mastra/core';

interface RerankerOptions {
  semanticProvider: 'cohere' | 'agent';
  weights: {
    semantic?: number;
    vector?: number;
    position?: number;
  };
  cohereApiKey?: string;
  cohereModel?: string;
  agentProvider?: {
    provider: string;
    name: string;
  };
}

export class RagReranker {
  private semanticProvider: CompletionProvider;
  private weights: Required<RerankerOptions['weights']>;

  constructor(options: RerankerOptions) {
    // Set up weights with defaults
    this.weights = {
      semantic: options.weights?.semantic ?? 0.4,
      vector: options.weights?.vector ?? 0.4,
      position: options.weights?.position ?? 0.2,
    };

    // Initialize semantic provider
    if (options.semanticProvider === 'cohere') {
      if (!options.cohereApiKey) {
        throw new Error('Cohere API key required when using Cohere provider');
      }
      if (!options.cohereModel) {
        throw new Error('Cohere model required when using Cohere provider');
      }
      this.semanticProvider = new CohereCompletionProvider(options.cohereApiKey, options.cohereModel);
    } else {
      if (!options.agentProvider) {
        throw new Error('Agent provider options required when using Agent provider');
      }
      this.semanticProvider = new AgentCompletionProvider(options.agentProvider.provider, options.agentProvider.name);
    }
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    // Check if vectors exist and have length
    if (!vec1?.length || !vec2?.length) return 0;

    //use shorter length for faster calculation
    const minLength = Math.min(vec1.length, vec2.length);

    // Calculate dot product, if vector is undefined at index, use 0
    const dotProduct = Array.from({ length: minLength }).reduce(
      (sum: number, _, i) => sum + (vec1[i] || 0) * (vec2[i] || 0),
      0,
    );
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    // Avoid division by zero
    const mags = mag1 * mag2;
    return mags ? dotProduct / mags : 0;
  }

  private calculatePositionScore(position: number, totalChunks: number): number {
    return 1 - position / totalChunks;
  }

  async rerank(params: {
    query: string;
    queryEmbedding: number[];
    chunks: any[];
    topK?: number;
  }): Promise<{ chunk: any; score: number; details: any }[]> {
    const { query, queryEmbedding, chunks, topK = 3 } = params;

    // Get scores for each chunk
    const scoredChunks = await Promise.all(
      chunks.map(async (chunk, index) => {
        // 1. Semantic relevance
        const semanticScore = await this.semanticProvider.getRelevanceScore(query, chunk.text);

        // 2. Vector similarity
        const vectorScore = this.cosineSimilarity(queryEmbedding, chunk.embedding);

        // 3. Position score
        const positionScore = this.calculatePositionScore(index, chunks.length);

        // Combined weighted score
        const finalScore =
          this.weights.semantic * semanticScore +
          this.weights.vector * vectorScore +
          this.weights.position * positionScore;

        return {
          chunk,
          score: finalScore,
          details: {
            semantic: semanticScore,
            vector: vectorScore,
            position: positionScore,
          },
        };
      }),
    );

    // Sort by score and take top K
    return scoredChunks.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
