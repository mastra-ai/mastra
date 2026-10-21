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
    expect(args.slice(2)).toEqual([
      '2',
      'mastra:cache:events',
      'mastra:cache:events:counter',
      '{"type":"chunk"}',
      '300',
    ]);
  });

  it('expire sets the key TTL in seconds and ignores a non-positive TTL', async () => {
    command.mockResolvedValueOnce('60').mockResolvedValueOnce(1);

    await cache.expire('events', 91_000);
    expect(command.mock.calls[0]?.[0]).toEqual(['TTL', 'mastra:cache:events']);
    expect(command.mock.calls[1]?.[0]).toEqual(['EXPIRE', 'mastra:cache:events', '91']);

    await cache.expire('events', 0);
    // Valkey treats EXPIRE with a non-positive TTL as a delete, so it is skipped.
    expect(command).toHaveBeenCalledTimes(2);
  });

  it('expire never shortens a longer or persistent key', async () => {
    // A cache configured for a week keeps its week.
    command.mockResolvedValueOnce(String(7 * 24 * 60 * 60));
    await cache.expire('events', 24 * 60 * 60 * 1000);
    expect(command).toHaveBeenCalledTimes(1);

    // `-1` is a key without expiry; it stays persistent.
    command.mockResolvedValueOnce('-1');
    await cache.expire('events', 24 * 60 * 60 * 1000);
    expect(command).toHaveBeenCalledTimes(2);
  });
});
