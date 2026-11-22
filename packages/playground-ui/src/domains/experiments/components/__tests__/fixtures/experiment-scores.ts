import type { ClientScoreRowData } from '@mastra/client-js';

const baseScore: ClientScoreRowData = {
  id: 'score-accuracy',
  scorerId: 'accuracy',
  entityId: 'item-agent-traced',
  runId: 'exp-1',
  output: { text: 'traced answer' },
  score: 0.5,
  reason: 'Half right',
  scorer: { id: 'accuracy', name: 'Accuracy' },
  source: 'TEST',
  entity: { id: 'item-agent-traced' },
  traceId: 'trace-res-agent-traced',
  createdAt: '2026-08-25T10:00:03.000Z',
  updatedAt: '2026-08-25T10:00:03.000Z',
};

/** Two scores of `agentTracedResult`, in scorer order. */
export const tracedResultScores: ClientScoreRowData[] = [
  baseScore,
  {
    ...baseScore,
    id: 'score-tone',
    scorerId: 'tone',
    score: 1,
    reason: 'Polite',
    scorer: { id: 'tone', name: 'Tone' },
  },
];

/** Scores per item, as the KPIs read them: the average of 0.5, 1 and 1 is 0.833. */
export const kpiScoresByItemId: Record<string, Array<Pick<ClientScoreRowData, 'score'>>> = {
  'item-1': [{ score: 0.5 }],
  'item-2': [{ score: 1 }, { score: 1 }],
};
