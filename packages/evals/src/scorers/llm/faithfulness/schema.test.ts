import { saveScorePayloadSchema } from '@mastra/core/evals';
import { describe, it, expect } from 'vitest';

describe('Faithfulness scorer preprocessStepResult schema compatibility', () => {
  it('should produce a preprocessStepResult that conforms to saveScorePayloadSchema (record, not array)', () => {
    // This test validates the fix for https://github.com/mastra-ai/mastra/issues/12876
    // The bug was that the preprocess outputSchema was z.array(z.string()), which
    // produced a raw array as preprocessStepResult. The saveScorePayloadSchema expects
    // preprocessStepResult to be a record (z.record(z.string(), z.unknown())), not an array.

    // Simulates what the old code would produce: a raw array
    const rawArrayResult = ['claim 1', 'claim 2'];

    // Simulates what the fixed code produces: an object with a claims property
    const objectResult = { claims: ['claim 1', 'claim 2'] };

    const basePayload = {
      scorerId: 'faithfulness-scorer',
      entityId: 'test-agent',
      runId: 'test-run-id',
      input: [{ role: 'user', content: 'test' }],
      output: [{ role: 'assistant', content: 'test' }],
      score: 0.5,
      scorer: { id: 'faithfulness-scorer', name: 'Faithfulness Scorer' },
      source: 'TEST' as const,
      entity: { id: 'test-agent', name: 'Test Agent' },
      entityType: 'AGENT',
    };

    // The old (buggy) format should fail schema validation
    expect(() => {
      saveScorePayloadSchema.parse({
        ...basePayload,
        preprocessStepResult: rawArrayResult,
      });
    }).toThrow();

    // The new (fixed) format should pass schema validation
    expect(() => {
      saveScorePayloadSchema.parse({
        ...basePayload,
        preprocessStepResult: objectResult,
      });
    }).not.toThrow();
  });
});
