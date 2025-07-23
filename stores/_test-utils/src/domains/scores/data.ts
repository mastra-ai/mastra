import { randomUUID } from 'crypto';
import type { ScoreRowData, ScoringEntityType } from '@mastra/core/scores';

export function createSampleScore({
  scorerId,
  entityId,
  entityType,
}: {
  scorerId: string;
  entityId?: string;
  entityType?: ScoringEntityType;
}): ScoreRowData {
  return {
    id: randomUUID(),
    entityId: entityId ?? 'eval-agent',
    entityType: entityType ?? 'AGENT',
    scorerId,
    createdAt: new Date(),
    updatedAt: new Date(),
    runId: randomUUID(),
    reason: 'Sample reason',
    extractStepResult: {
      text: 'Sample extract step result',
    },
    analyzeStepResult: {
      text: 'Sample analyze step result',
    },
    score: 0.8,
    extractPrompt: 'Sample extract prompt',
    analyzePrompt: 'Sample analyze prompt',
    reasonPrompt: 'Sample reason prompt',
    scorer: {
      id: scorerId,
      name: 'my-eval',
      description: 'My eval',
    },
    input: [
      {
        id: randomUUID(),
        name: 'input-1',
        value: 'Sample input',
      },
    ],
    output: {
      text: 'Sample output',
    },
    source: 'LIVE',
    entity: {
      id: entityId ?? 'eval-agent',
      name: 'Sample entity',
    },
    runtimeContext: {},
  };
}
