import { MastraAgentRelevanceScorer, CohereRelevanceScorer, RelevanceScoreProvider, QueryResult } from '@mastra/core';

// Default weights for different scoring components
const DEFAULT_WEIGHTS = {
  semantic: 0.4,
  vector: 0.4,
  position: 0.2,
} as const;

type WeightConfig = {
  semantic?: number;
  vector?: number;
  position?: number;
};

interface RerankParams {
  query: string;
  vectorStoreResults: QueryResult[];
  queryEmbedding?: number[];
  topK?: number;
}

interface RerankDetails {
  semantic: number;
  vector: number;
  position: number;
  queryAnalysis?: {
    magnitude: number;
    dominantFeatures: number[];
  };
}

interface RerankResult {
  result: QueryResult;
  score: number;
  details: RerankDetails;
}

export interface RerankerOptions {
  semanticProvider: 'cohere' | 'agent';
  weights?: WeightConfig;
  cohereApiKey?: string;
  cohereModel?: string;
  agentProvider?: {
    provider: string;
    name: string;
  };
}

// Takes in a list of results from a vector store and reranks them based on semantic, vector, and position scores
export class RagReranker {
  private semanticProvider: RelevanceScoreProvider;
  private weights: Required<WeightConfig>;

  constructor(options: RerankerOptions) {
    // Set up different weights for scoring components. Uses default weights if not provided
    this.weights = {
      ...DEFAULT_WEIGHTS,
      ...options.weights,
    };

    // Initialize semantic provider
    if (options.semanticProvider === 'cohere') {
      if (!options.cohereApiKey) {
        throw new Error('Cohere API key required when using Cohere provider');
      }
      this.semanticProvider = new CohereRelevanceScorer(options.cohereApiKey, options.cohereModel ?? '');
    } else {
      if (!options.agentProvider) {
        throw new Error('Agent provider options required when using Agent provider');
      }
      this.semanticProvider = new MastraAgentRelevanceScorer(
        options.agentProvider.provider,
        options.agentProvider.name,
      );
    }
  }

  // Calculate position score based on position in original list
  private calculatePositionScore(position: number, totalChunks: number): number {
    return 1 - position / totalChunks;
  }

  // Analyze query embedding features if needed
  private analyzeQueryEmbedding(embedding: number[]): {
    magnitude: number;
    dominantFeatures: number[];
  } {
    // Calculate embedding magnitude
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

    // Find dominant features (highest absolute values)
    const dominantFeatures = embedding
      .map((value, index) => ({ value: Math.abs(value), index }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(item => item.index);

    return { magnitude, dominantFeatures };
  }

  // Adjust scores based on query characteristics
  private adjustScores(score: number, queryAnalysis: { magnitude: number; dominantFeatures: number[] }): number {
    const magnitudeAdjustment = queryAnalysis.magnitude > 10 ? 1.1 : 1;

    const featureStrengthAdjustment = queryAnalysis.magnitude > 5 ? 1.05 : 1;

    return score * magnitudeAdjustment * featureStrengthAdjustment;
  }

  async rerank({ query, vectorStoreResults, queryEmbedding, topK = 3 }: RerankParams): Promise<RerankResult[]> {
    const resultLength = vectorStoreResults.length;

    const queryAnalysis = queryEmbedding ? this.analyzeQueryEmbedding(queryEmbedding) : null;

    // Get scores for each result
    const scoredResults = await Promise.all(
      vectorStoreResults.map(async (result, index) => {
        // Get semantic score from chosen provider
        const semanticScore = await this.semanticProvider.getRelevanceScore(query, result?.metadata?.text);

        // Get existing vector score from result
        const vectorScore = result.score;

        // Get score of vector based on position in original list
        const positionScore = this.calculatePositionScore(index, resultLength);

        // Combine scores using weights for each component
        let finalScore =
          this.weights.semantic * semanticScore +
          this.weights.vector * vectorScore +
          this.weights.position * positionScore;

        if (queryAnalysis) {
          finalScore = this.adjustScores(finalScore, queryAnalysis);
        }

        return {
          result,
          score: finalScore,
          details: {
            semantic: semanticScore,
            vector: vectorScore,
            position: positionScore,
            ...(queryAnalysis && {
              queryAnalysis: {
                magnitude: queryAnalysis.magnitude,
                dominantFeatures: queryAnalysis.dominantFeatures,
              },
            }),
          },
        };
      }),
    );

    // Sort by score and take top K
    return scoredResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
