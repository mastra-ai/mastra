import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';

import { MemoryLibSQL } from './index';

const createdAt = new Date('2026-01-01T00:00:00Z');

describe('bounded observational history in LibSQL', () => {
  it('uses a stable timestamp/id boundary across tied rows and a database reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'om-history-'));
    let client = createClient({ url: `file:${join(directory, 'history.db')}` });
    try {
      let store = new MemoryLibSQL({ client });
      await store.init();
      for (const threadId of ['thread-a', 'thread-b']) {
        await store.saveThread({
          thread: { id: threadId, resourceId: 'resource', title: threadId, createdAt, updatedAt: createdAt },
        });
      }
      // The binary order deliberately differs from locale collation. Resource pages
      // have one global budget, rather than a separate window for each thread.
      const ids = ['z', 'a', 'Z', 'é', '😀'];
      await store.saveMessages({
        messages: ids.map((id, index) => ({
          id,
          role: 'user',
          threadId: index % 2 ? 'thread-a' : 'thread-b',
          resourceId: 'resource',
          createdAt,
          content: { format: 2, parts: [{ type: 'text', text: id }] },
        })),
      });
      const expected = [...ids].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      const execute = vi.spyOn(client, 'execute');
      const first = await store.listObservationHistory({ resourceId: 'resource', limit: 2 });
      expect(first.messages.map(message => message.id)).toEqual(expected.slice(0, 2));
      expect(first.hasMore).toBe(true);
      expect(
        execute.mock.calls.map(([statement]) => (typeof statement === 'string' ? statement : statement.sql)).join('\n'),
      ).not.toMatch(/COUNT\(/i);
      execute.mockRestore();

      const record = await store.initializeObservationalMemory({
        threadId: null,
        resourceId: 'resource',
        scope: 'resource',
        config: {},
      });
      const after = { createdAt: createdAt.toISOString(), id: first.messages.at(-1)!.id };
      expect(
        await store.commitActiveObservations({
          id: record.id,
          observations: 'observed prefix',
          tokenCount: 2,
          lastObservedAt: createdAt,
          observedMessageIds: first.messages.map(message => message.id),
          observationHistory: { after, end: createdAt.toISOString() },
          expectedActiveObservations: 'wrong snapshot',
        }),
      ).toMatchObject({ applied: false });
      expect((await store.getObservationalMemory(null, 'resource'))!.metadata?.observationHistory).toBeUndefined();
      expect(
        await store.commitActiveObservations({
          id: record.id,
          observations: 'observed prefix',
          tokenCount: 2,
          lastObservedAt: createdAt,
          observedMessageIds: first.messages.map(message => message.id),
          observationHistory: { after, end: createdAt.toISOString() },
          expectedActiveObservations: record.activeObservations,
        }),
      ).toMatchObject({ applied: true });
      client.close();
      client = createClient({ url: `file:${join(directory, 'history.db')}` });
      store = new MemoryLibSQL({ client });
      await store.init();
      const reopened = (await store.getObservationalMemory(null, 'resource'))!;
      expect(reopened.metadata?.observationHistory).toEqual({ after, end: createdAt.toISOString() });
      const rest = await store.listObservationHistory({
        resourceId: 'resource',
        after,
        end: createdAt.toISOString(),
        limit: 10,
      });
      expect(rest.messages.map(message => message.id)).toEqual(expected.slice(2));
      expect(rest.hasMore).toBe(false);
      await store.commitActiveObservations({
        id: reopened.id,
        observations: reopened.activeObservations,
        tokenCount: reopened.observationTokenCount,
        lastObservedAt: createdAt,
        observationHistory: {
          after: { createdAt: createdAt.toISOString(), id: expected[0]! },
          end: '2027-01-01T00:00:00.000Z',
        },
      });
      const retained = (await store.getObservationalMemory(null, 'resource'))!;
      expect(retained.metadata?.observationHistory).toEqual({ after, end: createdAt.toISOString() });
      const reflected = await store.createReflectionGeneration({
        currentRecord: retained,
        reflection: 'compressed prefix',
        tokenCount: 1,
      });
      expect(reflected.metadata?.observationHistory).toEqual({ after, end: createdAt.toISOString() });
      expect(
        (await store.listObservationHistory({ threadId: 'thread-a', resourceId: 'other-resource', limit: 10 }))
          .messages,
      ).toEqual([]);
    } finally {
      client.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
