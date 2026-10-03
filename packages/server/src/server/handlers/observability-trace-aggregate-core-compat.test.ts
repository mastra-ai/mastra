import { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';

vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  return {
    ...actual,
    traceAggregateRequestSchema: undefined,
    traceAggregateResponseSchema: undefined,
    planTraceAggregate: undefined,
  };
});

const { AGGREGATE_TRACES } = await import('./observability-new-endpoints');
const { supportsTraceAggregateCore } = await import('./observability-shared');

async function captureHttpException(call: Promise<unknown>) {
  try {
    await call;
    throw new Error('Expected request to fail');
  } catch (error) {
    if (!(error instanceof HTTPException)) throw error;
    return error;
  }
}

describe('trace aggregate Core compatibility', () => {
  it('reports aggregate support as unavailable when the installed Core lacks aggregate symbols', () => {
    expect(supportsTraceAggregateCore()).toBe(false);
  });

  it('returns a structured 501 instead of a 500 when the installed Core lacks aggregate symbols', async () => {
    const mastra = new Mastra({});
    const getStorage = vi.spyOn(mastra, 'getStorage');

    const error = await captureHttpException(
      AGGREGATE_TRACES.handler({
        ...createTestServerContext({ mastra }),
        timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
        measures: ['count'],
      }),
    );

    expect(error.status).toBe(501);
    await expect(error.getResponse().json()).resolves.toEqual({
      code: 'TRACE_AGGREGATE_UNSUPPORTED',
      message: 'Trace aggregation requires a newer @mastra/core. Please upgrade.',
    });
    expect(getStorage).not.toHaveBeenCalled();
  });
});
