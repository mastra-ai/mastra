import { GlideClient } from '@valkey/valkey-glide';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client';
import type { ValkeyClientOptions } from './client';

vi.mock('@valkey/valkey-glide', async importOriginal => {
  const actual = await importOriginal<typeof import('@valkey/valkey-glide')>();
  return {
    ...actual,
    GlideClient: { ...actual.GlideClient, createClient: vi.fn().mockResolvedValue({}) },
  };
});

const glideConfig = async (options: ValkeyClientOptions) => {
  await createClient(options).connect();
  return vi.mocked(GlideClient.createClient).mock.calls[0]![0];
};

describe('ValkeyStreamsClient connection config', () => {
  afterEach(() => {
    vi.mocked(GlideClient.createClient).mockClear();
  });

  it.each([
    ['rediss://host:6380', true],
    ['valkeys://host:6380', true],
    ['valkey://host:6379', false],
    ['redis://host:6379', false],
  ])('derives useTLS from the scheme of %s', async (url, useTLS) => {
    expect((await glideConfig({ url })).useTLS).toBe(useTLS);
  });

  it('lets an explicit useTLS override the URL scheme', async () => {
    expect((await glideConfig({ url: 'rediss://host', useTLS: false })).useTLS).toBe(false);
    vi.mocked(GlideClient.createClient).mockClear();
    expect((await glideConfig({ url: 'valkey://host', useTLS: true })).useTLS).toBe(true);
  });

  it('still parses address, credentials and database from a TLS URL', async () => {
    expect(await glideConfig({ url: 'rediss://user:pw@host:6380/2' })).toMatchObject({
      addresses: [{ host: 'host', port: 6380 }],
      credentials: { username: 'user', password: 'pw' },
      databaseId: 2,
      useTLS: true,
    });
  });
});
