import { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';

vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  return {
    ...actual,
    getTraceQueryFieldsArgsSchema: undefined,
    getTraceQueryFieldsResponseSchema: undefined,
    getTraceQueryValuesArgsSchema: undefined,
    getTraceQueryValuesResponseSchema: undefined,
    planTraceQueryObservedFields: undefined,
    planTraceQueryValues: undefined,
    getTraceQueryCanonicalFieldDescriptors: undefined,
    TraceQueryResourceLimitError: undefined,
  };
});

const { GET_TRACE_QUERY_FIELDS, GET_TRACE_QUERY_VALUES } = await import('./observability-new-endpoints');

async function captureHttpException(call: Promise<unknown>) {
  try {
    await call;
    throw new Error('Expected request to fail');
  } catch (error) {
    if (!(error instanceof HTTPException)) throw error;
    return error;
  }
}

describe('trace-query discovery Core compatibility', () => {
  it.each([
    {
      name: 'field discovery',
      call: (mastra: Mastra) =>
        GET_TRACE_QUERY_FIELDS.handler({
          ...createTestServerContext({ mastra }),
          timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
          predicateScope: 'trace',
        }),
    },
    {
      name: 'value discovery',
      call: (mastra: Mastra) =>
        GET_TRACE_QUERY_VALUES.handler({
          ...createTestServerContext({ mastra }),
          timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
          predicateScope: 'trace',
          path: 'environment',
        }),
    },
  ])('returns a structured 501 for $name when the installed Core lacks discovery symbols', async ({ call }) => {
    const mastra = new Mastra({});
    const getStorage = vi.spyOn(mastra, 'getStorage');

    const error = await captureHttpException(call(mastra));

    expect(error.status).toBe(501);
    await expect(error.getResponse().json()).resolves.toEqual({
      code: 'TRACE_QUERY_DISCOVERY_UNSUPPORTED',
      message: 'Trace query discovery requires a newer @mastra/core. Please upgrade.',
    });
    expect(getStorage).not.toHaveBeenCalled();
  });
});
