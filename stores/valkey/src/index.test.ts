import type { GlideClient } from '@valkey/valkey-glide';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValkeyServerCache } from './index';

const createClient = () =>
  ({
    customCommand: vi.fn(),
  }) as unknown as GlideClient;

describe('ValkeyServerCache', () => {
  let client: GlideClient;
  let command: ReturnType<typeof vi.fn>;
  let cache: ValkeyServerCache;

  beforeEach(() => {
    client = createClient();
    command = client.customCommand as ReturnType<typeof vi.fn>;
    cache = new ValkeyServerCache({ client });
  });

  it('stores and reads JSON values through GLIDE custom commands', async () => {
    command.mockResolvedValueOnce('OK').mockResolvedValueOnce('{"foo":"bar"}');

    await cache.set('key', { foo: 'bar' });
    const value = await cache.get('key');

    expect(command.mock.calls[0]?.[0]).toEqual(['SET', 'mastra:cache:key', '{"foo":"bar"}', 'EX', '300']);
    expect(command.mock.calls[1]?.[0]).toEqual(['GET', 'mastra:cache:key']);
    expect(value).toEqual({ foo: 'bar' });
  });

  it('clears all matching keys across scan pages', async () => {
    command
      .mockResolvedValueOnce(['12', ['mastra:cache:a']])
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(['0', ['mastra:cache:b']])
      .mockResolvedValueOnce(1);

    await cache.clear();

    expect(command.mock.calls.map(call => call[0])).toEqual([
      ['SCAN', '0', 'MATCH', 'mastra:cache:*', 'COUNT', '100'],
      ['DEL', 'mastra:cache:a'],
      ['SCAN', '12', 'MATCH', 'mastra:cache:*', 'COUNT', '100'],
      ['DEL', 'mastra:cache:b'],
    ]);
  });

  it('listPushIndexed runs a single EVAL carrying both keys, the index-less body and the TTL', async () => {
    command.mockResolvedValueOnce(3);

    const index = await cache.listPushIndexed('events', 'events:counter', { index: 99, type: 'chunk' });

    expect(index).toBe(3);
    expect(command).toHaveBeenCalledTimes(1);
    const args = command.mock.calls[0]?.[0] as string[];
    expect(args[0]).toBe('EVAL');
    expect(args[1]).toContain("redis.call('INCR', KEYS[2])");
    // Deadlines are read before the writes so an append cannot stamp the cache
    // default over a window extended for a parked run. Lua can't execute here,
    // so the real behavior is covered against a live Valkey in CI.
    expect(args[1]!.indexOf("redis.call('TTL', KEYS[1])")).toBeLessThan(args[1]!.indexOf("redis.call('INCR'"));
    expect(args[1]).toContain('current ~= -1 and current < ttl');
    expect(args.slice(2)).toEqual([
      '2',
      'mastra:cache:events',
      'mastra:cache:events:counter',
      '{"type":"chunk"}',
      '300',
    ]);
  });

  it('expire extends the key TTL in seconds with one atomic script', async () => {
    command.mockResolvedValueOnce(1);

    await cache.expire('events', 91_000);

    // The TTL check and the EXPIRE share one script, so an append stamping its
    // own deadline cannot interleave between them.
    const args = command.mock.calls[0]?.[0] as string[];
    expect(args[0]).toBe('EVAL');
    expect(args[1]).toContain("redis.call('TTL', KEYS[1])");
    expect(args.slice(2)).toEqual(['1', 'mastra:cache:events', '91']);

    await cache.expire('events', 0);
    // A non-positive TTL means "no extension", not "delete".
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('expire only ever lengthens the deadline', async () => {
    // Lua cannot run here, so assert the script reads TTL itself, returns
    // without writing for persistent (-1) or missing (-2) keys, and compares
    // before it extends. Behaviour is covered against real Valkey by CI.
    command.mockResolvedValueOnce(1);
    await cache.expire('events', 24 * 60 * 60 * 1000);

    const args = command.mock.calls[0]?.[0] as string[];
    const script = args[1]!;
    expect(script.indexOf("redis.call('TTL', KEYS[1])")).toBeGreaterThan(-1);
    expect(script).toContain('if current == -1 or current == -2 then return 0 end');
    expect(script.indexOf('if current >= want then return 0 end')).toBeLessThan(script.indexOf("redis.call('EXPIRE'"));
    expect(args.slice(2)).toEqual(['1', 'mastra:cache:events', String(24 * 60 * 60)]);
  });

  it('expire leaves a cache configured without expiry persistent', async () => {
    // The cache itself never grants deadlines, so a parked-run retention bump
    // must not turn its keys into expiring ones.
    const immortal = new ValkeyServerCache({ client }, { ttlSeconds: 0 });

    await immortal.expire('events', 91_000);

    expect(command).not.toHaveBeenCalled();
  });
});
