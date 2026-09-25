import type { ComponentProps } from 'react';

import type { ScoreAsItemDialog } from '../../score-as-item-dialog';

type ScoreAsItemDialogScore = NonNullable<ComponentProps<typeof ScoreAsItemDialog>['score']>;

export function createScore(input: unknown, output: unknown): ScoreAsItemDialogScore {
  const timestamp = new Date('2026-07-16T12:00:00.000Z');

  return {
    id: 'score-1',
    scorerId: 'scorer-1',
    entityId: 'agent-1',
    runId: 'run-1',
    input,
    output,
    score: 1,
    scorer: {},
    source: 'LIVE',
    entity: {},
    traceId: 'trace-1',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
