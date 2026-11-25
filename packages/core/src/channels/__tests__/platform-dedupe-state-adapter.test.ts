import type { QueueEntry } from 'chat';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { PlatformDedupeStateAdapter } from '../platform-dedupe-state-adapter';
import { MastraStateAdapter } from '../state-adapter';

describe('PlatformDedupeStateAdapter', () => {
  let inner: MastraStateAdapter;

  const wrap = (getDedupeTtlMs: (key: string) => number | undefined) =>
    new PlatformDedupeStateAdapter(inner, getDedupeTtlMs);

  beforeEach(() => {
    inner = new MastraStateAdapter(new InMemoryMemory({ db: new InMemoryDB() }));
  });

  describe('setIfNotExists', () => {
    it('applies the window the resolver returns for the key', async () => {
      const setIfNotExists = vi.spyOn(inner, 'setIfNotExists');
      const adapter = wrap(key => (key.includes('dedupe:slack:') ? 1_000 : undefined));

      await expect(adapter.setIfNotExists('dedupe:slack:C123', true, 600_000)).resolves.toBe(true);

      expect(setIfNotExists).toHaveBeenCalledWith('dedupe:slack:C123', true, 1_000);
    });

    it('keeps the window it was given when the resolver has no answer', async () => {
      const setIfNotExists = vi.spyOn(inner, 'setIfNotExists');
      const adapter = wrap(key => (key.includes('dedupe:slack:') ? 1_000 : undefined));

      await adapter.setIfNotExists('dedupe:discord:C123', true, 600_000);

      expect(setIfNotExists).toHaveBeenCalledWith('dedupe:discord:C123', true, 600_000);
    });

    it('leaves a window the caller did not set alone', async () => {
      const setIfNotExists = vi.spyOn(inner, 'setIfNotExists');
      const adapter = wrap(() => undefined);

      await adapter.setIfNotExists('dedupe:discord:C123', true);

      expect(setIfNotExists).toHaveBeenCalledWith('dedupe:discord:C123', true, undefined);
    });

    it('reports a repeated key as a duplicate', async () => {
      const adapter = wrap(() => 1_000);

      await expect(adapter.setIfNotExists('dedupe:slack:C123', true, 600_000)).resolves.toBe(true);
      await expect(adapter.setIfNotExists('dedupe:slack:C123', true, 600_000)).resolves.toBe(false);
    });

    it('expires the key once the per-platform window has passed', async () => {
      vi.useFakeTimers();
      try {
        const adapter = wrap(() => 1_000);
        await adapter.setIfNotExists('dedupe:slack:C123', true, 600_000);

        // Past the 1s window the wrapper asked for, so the key is free again.
        vi.setSystemTime(Date.now() + 1_001);

        await expect(adapter.setIfNotExists('dedupe:slack:C123', true, 600_000)).resolves.toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not change the window of any other write', async () => {
      const set = vi.spyOn(inner, 'set');
      const adapter = wrap(() => 1_000);

      await adapter.set('dedupe:slack:C123', true, 600_000);

      expect(set).toHaveBeenCalledWith('dedupe:slack:C123', true, 600_000);
    });
  });

  describe('everything else', () => {
    it('forwards the rest of the state adapter to the wrapped adapter', async () => {
      const adapter = wrap(() => undefined);

      await adapter.connect();
      expect(await adapter.isSubscribed('slack:C123:1')).toBe(false);

      const lock = await adapter.acquireLock('slack:C123:1', 1_000);
      expect(lock).not.toBeNull();
      expect(await adapter.extendLock(lock!, 2_000)).toBe(true);
      await adapter.releaseLock(lock!);
      await adapter.forceReleaseLock('slack:C123:1');

      await adapter.appendToList('list-key', 'first', { maxLength: 5 });
      await adapter.appendToList('list-key', 'second', { maxLength: 5 });
      expect(await adapter.getList<string>('list-key')).toEqual(['first', 'second']);

      await adapter.set('cache-key', 'value');
      expect(await adapter.get<string>('cache-key')).toBe('value');
      await adapter.delete('cache-key');
      expect(await adapter.get<string>('cache-key')).toBeNull();

      const entry: QueueEntry = { enqueuedAt: Date.now(), expiresAt: Date.now() + 60_000, message: {} as never };
      expect(await adapter.enqueue('slack:C123:1', entry, 10)).toBe(1);
      expect(await adapter.queueDepth('slack:C123:1')).toBe(1);
      expect(await adapter.dequeue('slack:C123:1')).toEqual(entry);
      expect(await adapter.queueDepth('slack:C123:1')).toBe(0);

      await adapter.subscribe('slack:C123:1');
      await adapter.unsubscribe('slack:C123:1');
      await adapter.disconnect();
    });
  });
});
