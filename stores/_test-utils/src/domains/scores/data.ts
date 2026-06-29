import { randomUUID } from 'node:crypto';
import type { ScoreRowData, ScoringEntityType, ScoringSource } from '@mastra/core/evals';

export function createSampleScore({
  scorerId,
  entityId,
  entityType,
  source,
  traceId,
  spanId,
  organizationId,
  projectId,
  batchId,
  runId,
}: {
  scorerId: string;
  entityId?: string;
  entityType?: ScoringEntityType;
  source?: ScoringSource;
  traceId?: string;
  spanId?: string;
  organizationId?: string;
  projectId?: string;
  batchId?: string;
  runId?: string;
}): ScoreRowData {
  return {
    id: randomUUID(),
    entityId: entityId ?? 'eval-agent',
    entityType: entityType ?? 'AGENT',
    scorerId,
    traceId,
    spanId,
    organizationId,
    projectId,
    batchId,
    createdAt: new Date(),
    updatedAt: new Date(),
    runId: runId ?? randomUUID(),
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
    generateReasonPrompt: 'Sample reason prompt',
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
    requestContext: {},
    metadata: {
      scorerVersion: '1.0.0',
      customField: 'test-value',
    },
  };
}
