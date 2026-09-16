import type { GetObservabilityScores_Response, GetScoresScorers_Response } from '@mastra/client-js';

export const scoreMetricsScorers: GetScoresScorers_Response = {
  quality: {
    scorer: {
      config: {
        id: 'quality',
        description: 'Measures response quality',
      },
    },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'code',
  },
};

export const emptyScoreMetrics: GetObservabilityScores_Response = {
  scores: [],
};

const qualityScore = (timestamp: string, score: number): GetObservabilityScores_Response['scores'][number] => ({
  scorerId: 'quality',
  score,
  timestamp: new Date(timestamp),
});

export const scoreMetricsFirstPage: GetObservabilityScores_Response = {
  scores: [qualityScore('2026-07-02T10:00:00.000Z', 0.8), qualityScore('2026-07-02T09:00:00.000Z', 0.8)],
  pagination: { total: 3, page: 0, perPage: 100, hasMore: true },
};

export const scoreMetricsLastPage: GetObservabilityScores_Response = {
  scores: [qualityScore('2026-06-22T10:00:00.000Z', 0.2)],
  pagination: { total: 3, page: 1, perPage: 100, hasMore: false },
};
