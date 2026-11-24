import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { describe, expect, it, vi } from 'vitest';

import { MemoryLibSQL } from './index';

const createdAt = new Date('2026-01-01T00:00:00Z');

describe('bounded observational history in LibSQL', () => {
  it('normalizes legacy string-content rows into observable text parts', async () => {
    const client = createClient({ url: ':memory:' });
    const store = new MemoryLibSQL({ client });
    try {
      await store.init();
      await store.saveThread({
        thread: { id: 'legacy-thread', title: 'Legacy', resourceId: 'resource', createdAt, updatedAt: createdAt },
      });
      await store.saveMessages({
        messages: [
          {
            id: 'legacy',
            threadId: 'legacy-thread',
            resourceId: 'resource',
            createdAt,
            role: 'user',
            content: 'Legacy fact' as any,
          },
        ],
      });
      const page = await store.listObservationHistory({ threadId: 'legacy-thread', limit: 40 });
      expect(page.messages[0]!.content).toMatchObject({ format: 2, parts: [{ type: 'text', text: 'Legacy fact' }] });
    } finally {
      client.close();
    }
  });
  it.each(['thread', 'resource'] as const)(
    'persists the initial %s lower boundary before an observation or restart',
    async scope => {
      const directory = await mkdtemp(join(tmpdir(), 'om-initial-boundary-'));
      const url = `file:${join(directory, 'history.db')}`;
      let client = createClient({ url });
      try {
        let store = new MemoryLibSQL({ client });
        await store.init();
        await store.saveThread({
          thread: { id: 'thread', title: 'Initial history', resourceId: 'resource', createdAt, updatedAt: createdAt },
        });
        const ids = ['Z', 'a', 'z', 'é', '😀'];
        await store.saveMessages({
          messages: ids.map(id => ({
            id,
            role: 'user',
            threadId: 'thread',
            resourceId: 'resource',
            createdAt,
            content: { format: 2, parts: [{ type: 'text', text: id }] },
          })),
        });
        const selection = scope === 'thread' ? { threadId: 'thread' } : { resourceId: 'resource' };
        const first = await store.listObservationHistory({ ...selection, order: 'desc', limit: 2 });
        expect(first.messages.map(message => message.id)).toEqual(['😀', 'é']);
        const before = { createdAt: createdAt.toISOString(), id: 'é' };
        const second = await store.listObservationHistory({ ...selection, order: 'desc', before, limit: 2 });
        expect(second.messages.map(message => message.id)).toEqual(['z', 'a']);
        const after = { createdAt: createdAt.toISOString(), id: 'z' };
        const input = {
          threadId: scope === 'thread' ? 'thread' : null,
          resourceId: 'resource',
          scope,
          config: {},
          observationHistory: { after },
        };
        const record = await store.initializeObservationalMemory(input);
        expect(record.metadata?.observationHistory).toEqual({ after });
        expect(record.lastObservedAt).toBeUndefined();
        // A losing initializer must use the winner's boundary, not its own snapshot.
        const loser = await store.initializeObservationalMemory({ ...input, observationHistory: { after: before } });
        expect(loser.id).toBe(record.id);
        expect(loser.metadata?.observationHistory).toEqual({ after });
        client.close();
        client = createClient({ url });
        store = new MemoryLibSQL({ client });
        await store.init();
        const reopened = (await store.getObservationalMemory(input.threadId, input.resourceId))!;
        expect(reopened.metadata?.observationHistory).toEqual({ after });
        expect(
          (await store.listObservationHistory({ ...selection, after, limit: 40 })).messages.map(message => message.id),
        ).toEqual(['é', '😀']);
      } finally {
        client.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

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
