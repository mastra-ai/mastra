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

interface RerankDetails {
  semantic: number;
  vector: number;
  position: number;
  queryAnalysis?: {
    magnitude: number;
    dominantFeatures: number[];
  };
}

export interface RerankResult {
  result: QueryResult;
  score: number;
  details: RerankDetails;
}

// For use in the vector store tool
export interface RerankerOptions {
  weights?: WeightConfig;
  topK?: number;
}

// For use in the rerank function
export interface RerankerFunctionOptions {
  weights?: WeightConfig;
  queryEmbedding?: number[];
  topK?: number;
}

export interface RerankModelConfig {
  rerankProvider: 'cohere' | 'agent';
  cohereApiKey?: string;
  cohereModel?: string;
  agentProvider?: {
    provider: string;
    name: string;
  };
}

export interface RerankConfig {
  options?: RerankerOptions;
  model: RerankModelConfig;
}

// Calculate position score based on position in original list
function calculatePositionScore(position: number, totalChunks: number): number {
  return 1 - position / totalChunks;
}

// Analyze query embedding features if needed
function analyzeQueryEmbedding(embedding: number[]): {
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
function adjustScores(score: number, queryAnalysis: { magnitude: number; dominantFeatures: number[] }): number {
  const magnitudeAdjustment = queryAnalysis.magnitude > 10 ? 1.1 : 1;

  const featureStrengthAdjustment = queryAnalysis.magnitude > 5 ? 1.05 : 1;

  return score * magnitudeAdjustment * featureStrengthAdjustment;
}

// Takes in a list of results from a vector store and reranks them based on semantic, vector, and position scores
export async function rerank(
  results: QueryResult[],
  query: string,
  modelConfig: RerankModelConfig,
  options: RerankerFunctionOptions,
): Promise<RerankResult[]> {
  const { rerankProvider, cohereApiKey, cohereModel, agentProvider } = modelConfig;
  let semanticProvider: RelevanceScoreProvider;
  if (rerankProvider === 'cohere') {
    if (!cohereApiKey) {
      throw new Error('Cohere API key required when using Cohere provider');
    }
    semanticProvider = new CohereRelevanceScorer(cohereApiKey, cohereModel ?? '');
  } else {
    if (!agentProvider) {
      throw new Error('Agent provider options required when using Agent provider');
    }
    semanticProvider = new MastraAgentRelevanceScorer(agentProvider.provider, agentProvider.name);
  }
  const { queryEmbedding, topK = 3 } = options;
  const weights = {
    ...DEFAULT_WEIGHTS,
    ...options.weights,
  };
  const resultLength = results.length;

  const queryAnalysis = queryEmbedding ? analyzeQueryEmbedding(queryEmbedding) : null;

  // Get scores for each result
  const scoredResults = await Promise.all(
    results.map(async (result, index) => {
      // Get semantic score from chosen provider
      const semanticScore = await semanticProvider.getRelevanceScore(query, result?.metadata?.text);

      // Get existing vector score from result
      const vectorScore = result.score;

      // Get score of vector based on position in original list
      const positionScore = calculatePositionScore(index, resultLength);

      // Combine scores using weights for each component
      let finalScore =
        weights.semantic * semanticScore + weights.vector * vectorScore + weights.position * positionScore;

      if (queryAnalysis) {
        finalScore = adjustScores(finalScore, queryAnalysis);
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
