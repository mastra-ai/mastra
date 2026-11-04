import { Mastra } from '@mastra/core';
import { InMemoryStore } from '@mastra/core/storage';
import type { ObservabilityStorage } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

export interface ObservabilitySignalWriteTestConfig {
  startServer: (mastra: Mastra) => Promise<{
    request: (path: string, init?: RequestInit) => Promise<Response>;
    close: () => Promise<void>;
  }>;
}

/** Shared HTTP contract for feedback/score writes, backed by real in-memory storage. */
export function createObservabilitySignalWriteTestSuite({ startServer }: ObservabilitySignalWriteTestConfig) {
  describe.each(['feedback', 'scores'] as const)('%s HTTP writes', collection => {
    let server: Awaited<ReturnType<typeof startServer>>;
    let store: ObservabilityStorage;
    const isFeedback = collection === 'feedback';
    const field = isFeedback ? 'feedback' : 'score';
    const idField = isFeedback ? 'feedbackId' : 'scoreId';
    const payload = isFeedback ? { feedbackType: 'thumbs', value: 1 } : { scorerId: 'accuracy', score: 0.9 };
    const path = `/api/observability/${collection}`;

    beforeEach(async () => {
      const storage = new InMemoryStore();
      store = (await storage.getStore('observability'))!;
      server = await startServer(new Mastra({ storage, logger: false }));
    });
    afterEach(async () => {
      await server?.close();
    });

    const post = (record: Record<string, unknown>) =>
      server.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: record }),
      });
    const list = async () => {
      const response = await server.request(path);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<'feedback' | 'scores', Record<string, unknown>[]>;
      return body[collection];
    };

    it.each([undefined, null, '', ' ', '\t\n'])(
      'rejects traceId %j without persisting a record (OBS-788)',
      async traceId => {
        // Observe the real store without replacing it: validation must run before storage.
        const create = vi.spyOn(store, isFeedback ? 'createFeedback' : 'createScore');
        for (const spanId of [undefined, 'span-without-trace']) {
          const response = await post({ ...payload, traceId, spanId });
          expect(response.status, await response.clone().text()).toBe(400);
        }
        expect(create).not.toHaveBeenCalled();
        expect(await list()).toEqual([]);
      },
    );

    it.each([undefined, 'span-123'])(
      'persists a trace with spanId %j and preserves the write contract',
      async spanId => {
        const before = Date.now();
        // No trace is stored: this change requires an ID, not a trace-existence lookup.
        for (const id of [undefined, 'caller-id']) {
          const response = await post({ ...payload, traceId: 'trace-123', spanId, [idField]: id });
          expect(response.status, await response.clone().text()).toBe(200);
          expect(await response.json()).toEqual({ success: true });
        }
        const rows = await list();
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map(row => row[idField])).size).toBe(2);
        expect(rows.some(row => row[idField] === 'caller-id')).toBe(true);
        for (const row of rows) {
          expect(row).toMatchObject({ ...payload, traceId: 'trace-123' });
          expect(row.spanId ?? null).toBe(spanId ?? null);
          expect(row[idField]).toEqual(expect.any(String));
          expect(String(row[idField]).length).toBeGreaterThan(0);
          expect(new Date(String(row.timestamp)).getTime()).toBeGreaterThanOrEqual(before);
          expect(new Date(String(row.timestamp)).getTime()).toBeLessThanOrEqual(Date.now());
        }
      },
    );

    it('still reads historical feedback and scores with no trace', async () => {
      const timestamp = new Date();
      if (isFeedback) {
        await store.createFeedback({
          feedback: { feedbackId: 'historical', timestamp, traceId: null, feedbackType: 'thumbs', value: 1 },
        });
      } else {
        await store.createScore({
          score: { scoreId: 'historical', timestamp, traceId: null, scorerId: 'accuracy', score: 0.9 },
        });
      }
      expect(await list()).toEqual([expect.objectContaining({ [idField]: 'historical', traceId: null })]);
    });
  });
}
