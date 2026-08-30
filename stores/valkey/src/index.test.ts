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
});
