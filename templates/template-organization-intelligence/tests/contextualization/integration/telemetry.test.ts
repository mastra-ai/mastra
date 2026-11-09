import { expect, it } from 'vitest';
import { TelemetryStore } from '../../../src/mastra/telemetry.js';

it('counts clarification requests separately from completed questions and operational errors', async () => {
  const telemetry = new TelemetryStore(':memory:');
  try {
    for (const status of ['answered', 'clarification_required', 'operational_error'] as const) {
      await telemetry.recordQuery({
        status,
        retrievalMs: 1,
        durationMs: 2,
        sourceIds: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        cost: 'unavailable',
      });
    }
    expect(await telemetry.summary()).toMatchObject({
      completedQuestions: 1,
      clarificationRequests: 1,
      operationalErrors: 1,
      insufficientEvidence: 0,
      unansweredRate: 0,
      usage: { inputTokens: 3, outputTokens: 3, totalTokens: 6 },
    });
  } finally {
    await telemetry.close();
  }
});
