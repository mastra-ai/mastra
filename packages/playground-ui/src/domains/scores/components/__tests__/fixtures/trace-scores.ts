import type { ClientScoreRowData, GetScorerResponse, ListScoresResponse } from '@mastra/client-js';

/** One scoring of the trace's root span, as `listScoresBySpan` returns it. */
export function buildScore(overrides: Partial<ClientScoreRowData>): ClientScoreRowData {
  return {
    id: 'score-1',
    scorerId: 'answer-relevancy',
    entityId: 'agent-1',
    runId: 'run-1',
    score: 0.5,
    scorer: { name: 'Answer relevancy' },
    source: 'LIVE',
    entity: {},
    traceId: 'trace-1',
    spanId: 'root',
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

export function scoresResponse(scores: ClientScoreRowData[], hasMore = false, page = 0): ListScoresResponse {
  return { scores, pagination: { total: scores.length, page, perPage: 10, hasMore } };
}

const scorerEntry = (id: string, name: string, type?: string): GetScorerResponse => ({
  scorer: { config: { id, name, description: `${name} description`, type } },
  agentIds: [],
  agentNames: [],
  workflowIds: [],
  isRegistered: true,
  source: 'code',
});

/** The scorers a host lists (`listScorers`): a span scorer, an agent-only scorer and an unregistered one. */
export const listedScorers: Record<string, GetScorerResponse> = {
  helpfulness: scorerEntry('helpfulness', 'Helpfulness'),
  'answer-relevancy': scorerEntry('answer-relevancy', 'Answer relevancy', 'agent'),
  draft: { ...scorerEntry('draft', 'Draft scorer'), isRegistered: false },
};
