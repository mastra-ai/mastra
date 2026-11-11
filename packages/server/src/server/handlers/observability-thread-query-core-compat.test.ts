import { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';

vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  return {
    ...actual,
    planThreadRowsQuery: undefined,
    threadQueryRequestSchema: undefined,
    threadQueryResponseSchema: undefined,
    THREAD_QUERY_FIELD_REGISTRY: undefined,
  };
});
const { QUERY_THREADS } = await import('./observability-new-endpoints');

describe('thread row core compatibility', () => {
  it('loads with older core and returns 501 for a row request without touching storage', async () => {
    const mastra = new Mastra({});
    const getStorage = vi.spyOn(mastra, 'getStorage');
    try {
      await QUERY_THREADS.handler({
        ...createTestServerContext({ mastra }),
        timeRange: { traces: { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' } },
      });
      throw new Error('Expected 501');
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPException);
      expect((error as HTTPException).status).toBe(501);
      expect(await (error as HTTPException).getResponse().json()).toMatchObject({ code: 'TRACE_QUERY_UNSUPPORTED' });
    }
    expect(getStorage).not.toHaveBeenCalled();
  });
});
