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
  createdAt: new Date('2026-08-25T10:00:03.000Z'),
  updatedAt: new Date('2026-08-25T10:00:03.000Z'),
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
