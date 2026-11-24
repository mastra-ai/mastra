import { Mastra } from '@mastra/core';
import { describe, expect, it, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';

// Older Core accepts this field; newer Server must never silently discard it.
vi.mock('@mastra/core/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/core/storage')>();
  const { z } = await import('zod/v4');
  const legacySchema = z.object({
    timeRange: z.object({ from: z.string(), to: z.string() }),
    textSearch: z.string().optional(),
  });
  return { ...actual, traceQueryRequestSchema: legacySchema, spanQueryRequestSchema: legacySchema };
});

const { QUERY_TRACES, QUERY_SPANS } = await import('./observability-new-endpoints');

describe('legacy search Core compatibility', () => {
  it.each([
    [QUERY_TRACES, 'TRACE_QUERY_UNSUPPORTED'],
    [QUERY_SPANS, 'SPAN_QUERY_UNSUPPORTED'],
  ] as const)('rejects accepted legacy search before reaching storage (%s)', async (route, code) => {
    const mastra = new Mastra({});
    const storage = vi.spyOn(mastra, 'getStorage');
    const body = route.bodySchema!.parse({
      timeRange: { from: '2026-08-01T00:00:00Z', to: '2026-08-02T00:00:00Z' },
      textSearch: 'needle',
    });
    try {
      await route.handler({ ...createTestServerContext({ mastra }), ...body });
      expect.fail('Legacy search must be rejected');
    } catch (error) {
      if (!(error instanceof HTTPException)) throw error;
      expect(error.status).toBe(501);
      expect(await error.getResponse().json()).toMatchObject({ code, message: expect.stringContaining('textSearch') });
    }
    expect(storage).not.toHaveBeenCalled();
  });
});
