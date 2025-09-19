import { randomUUID } from 'crypto';
import type { ScoreRowData, ScoringEntityType, ScoringSource } from '@mastra/core/scores';

export function createSampleScore({
  scorerId,
  entityId,
  entityType,
  source,
}: {
  scorerId: string;
  entityId?: string;
  entityType?: ScoringEntityType;
  source?: ScoringSource;
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
    preprocessStepResult: {
      text: 'Sample preprocess step result',
    },
    preprocessPrompt: 'Sample preprocess prompt',
    analyzeStepResult: {
      text: 'Sample analyze step result',
    },
    score: 0.8,
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
    source: source ?? 'LIVE',
    entity: {
      id: entityId ?? 'eval-agent',
      name: 'Sample entity',
    },
    runtimeContext: {},
  };
}
