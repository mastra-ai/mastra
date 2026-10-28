import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';

import { getTimeToFirstTokenMs } from './time-to-first-token';

describe('getTimeToFirstTokenMs', () => {
  const start = '2026-01-01T00:00:00.000Z';

  it('measures a MODEL_INFERENCE span from its own start, ignoring a copied clock', () => {
    expect(
      getTimeToFirstTokenMs({
        type: SpanType.MODEL_INFERENCE,
        startTime: start,
        attributes: { inferenceStartTime: '2025-12-31T23:59:59.000Z', completionStartTime: '2026-01-01T00:00:00.300Z' },
      }),
    ).toBe(300);
  });

  it('measures spans above it from the copied inference start, not their own start', () => {
    expect(
      getTimeToFirstTokenMs({
        type: SpanType.AGENT_RUN,
        startTime: start,
        attributes: {
          inferenceStartTime: new Date('2026-01-01T00:00:00.100Z'),
          completionStartTime: new Date('2026-01-01T00:00:00.300Z'),
        },
      }),
    ).toBe(200);
  });

  it('is undefined when either clock is missing', () => {
    expect(getTimeToFirstTokenMs({ type: SpanType.MODEL_INFERENCE, startTime: start, attributes: {} })).toBeUndefined();
    expect(
      getTimeToFirstTokenMs({
        type: SpanType.MODEL_STEP,
        startTime: start,
        attributes: { completionStartTime: '2026-01-01T00:00:00.300Z' },
      }),
    ).toBeUndefined();
  });

  it('clamps a first chunk recorded before the inference start to zero', () => {
    expect(
      getTimeToFirstTokenMs({
        type: SpanType.MODEL_GENERATION,
        startTime: start,
        attributes: { inferenceStartTime: '2026-01-01T00:00:00.500Z', completionStartTime: '2026-01-01T00:00:00.300Z' },
      }),
    ).toBe(0);
  });
});
