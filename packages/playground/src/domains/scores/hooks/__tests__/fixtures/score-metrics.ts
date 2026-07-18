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
