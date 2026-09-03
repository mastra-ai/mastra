import { describe, expect, it } from 'vitest';
import { langfuseObservationSchema, langfuseObservationsPageSchema } from './schema.js';

describe('Langfuse Observations API v2 schema', () => {
  it('retains every requested field group from the current V2 contract', () => {
    const observation = {
      id: 'observation-1',
      traceId: 'trace-1',
      startTime: '2026-08-20T10:00:00.000Z',
      endTime: '2026-08-20T10:00:02.000Z',
      projectId: 'project-1',
      parentObservationId: null,
      type: 'GENERATION',
      isRootObservation: true,
      name: 'answer',
      level: 'DEFAULT',
      statusMessage: 'ok',
      version: '1.0',
      environment: 'production',
      bookmarked: true,
      public: false,
      userId: 'user-1',
      sessionId: 'session-1',
      completionStartTime: '2026-08-20T10:00:01.000Z',
      createdAt: '2026-08-20T10:00:03.000Z',
      updatedAt: '2026-08-20T10:00:04.000Z',
      input: { question: 'hello', attachments: ['one', 'two'] },
      output: [{ role: 'assistant', content: 'world' }],
      metadata: { nested: { retained: true } },
      model: 'gpt-4o-mini',
      internalModelId: 'model-definition-1',
      modelParameters: { temperature: 0.2 },
      usageDetails: { input: 10, output: 4 },
      costDetails: { input: 0.000001, output: 0.000002 },
      totalCost: 0.000003,
      usagePricingTierId: 'tier-1',
      usagePricingTierName: 'Standard',
      promptId: 'prompt-1',
      promptName: 'support',
      promptVersion: 3,
      latency: 2,
      timeToFirstToken: 1,
      modelId: 'matched-model-1',
      inputPrice: '0.000000123456789',
      outputPrice: '0.000000987654321',
      totalPrice: null,
      traceName: 'support-trace',
      tags: ['migration'],
      release: '2026.08',
    };

    const parsed = langfuseObservationsPageSchema.parse({
      data: [observation],
      meta: { cursor: 'next-page' },
    });

    expect(parsed.data[0]).toEqual(observation);
    expect(parsed.meta.cursor).toBe('next-page');
  });

  it('accepts documented nullable values without inventing defaults', () => {
    const parsed = langfuseObservationSchema.parse({
      id: 'observation-1',
      traceId: null,
      startTime: '2026-08-20T10:00:00.000Z',
      endTime: null,
      projectId: 'project-1',
      parentObservationId: null,
      type: 'EVENT',
      name: null,
      metadata: null,
      model: null,
      modelId: null,
      inputPrice: null,
      outputPrice: null,
      totalPrice: null,
    });

    expect(parsed).toMatchObject({
      traceId: null,
      endTime: null,
      metadata: null,
      model: null,
    });
  });

  it('accepts every JSON-shaped input and output allowed by Observations API v2', () => {
    const values = [{ nested: ['object'] }, ['array', 1], 'plain string', 42, true, null];

    for (const value of values) {
      const parsed = langfuseObservationSchema.parse({
        id: `observation-${String(value)}`,
        traceId: 'trace-1',
        startTime: '2026-08-20T10:00:00.000Z',
        endTime: '2026-08-20T10:00:01.000Z',
        projectId: 'project-1',
        parentObservationId: null,
        type: 'SPAN',
        input: value,
        output: value,
      });
      expect(parsed.input).toEqual(value);
      expect(parsed.output).toEqual(value);
    }
  });
});
