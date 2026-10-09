import { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';

vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  return {
    ...actual,
    spanQueryRequestSchema: undefined,
    spanQueryResponseSchema: undefined,
    planSpanQuery: undefined,
  };
});

const { QUERY_SPANS } = await import('./observability-new-endpoints');
const { getObservabilityStorageCapabilities, supportsSpanQueryCore } = await import('./observability-shared');

async function captureHttpException(call: Promise<unknown>) {
  try {
    await call;
    throw new Error('Expected request to fail');
  } catch (error) {
    if (!(error instanceof HTTPException)) throw error;
    return error;
  }
}

describe('span query Core compatibility', () => {
  it('reports span-query support as unavailable when the installed Core lacks span-query symbols', () => {
    expect(supportsSpanQueryCore()).toBe(false);
    expect(
      getObservabilityStorageCapabilities({
        getFeatures: () => ['span-query'],
      } as unknown as Parameters<typeof getObservabilityStorageCapabilities>[0]).spanQuery,
    ).toBe(false);
  });

  it('returns a structured 501 instead of a 500 when the installed Core lacks span-query symbols', async () => {
    const mastra = new Mastra({});
    const getStorage = vi.spyOn(mastra, 'getStorage');

    const error = await captureHttpException(
      QUERY_SPANS.handler({
        ...createTestServerContext({ mastra }),
        timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
      }),
    );

    expect(error.status).toBe(501);
    await expect(error.getResponse().json()).resolves.toEqual({
      code: 'SPAN_QUERY_UNSUPPORTED',
      message: 'Span queries require a newer @mastra/core. Please upgrade.',
    });
    expect(getStorage).not.toHaveBeenCalled();
  });
});
