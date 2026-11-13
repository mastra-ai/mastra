import { GlideClient } from '@valkey/valkey-glide';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GlideValkeyClient } from './client';

vi.mock('@valkey/valkey-glide', async importOriginal => {
  const actual = await importOriginal<typeof import('@valkey/valkey-glide')>();
  return {
    ...actual,
    GlideClient: { ...actual.GlideClient, createClient: vi.fn().mockResolvedValue({}) },
  };
});

const connectConfig = async (client: GlideValkeyClient) => {
  await client.connect();
  return vi.mocked(GlideClient.createClient).mock.calls.at(-1)![0];
};

describe('GlideValkeyClient connection config', () => {
  afterEach(() => {
    vi.mocked(GlideClient.createClient).mockClear();
  });

  it('tags the client as mastra when Mastra builds it', async () => {
    expect((await connectConfig(new GlideValkeyClient({ addresses: [{ host: 'localhost' }] }))).clientInfoTag).toBe(
      'mastra',
    );
  });

  it('lets a user-supplied clientInfoTag override the default', async () => {
    const config = await connectConfig(
      new GlideValkeyClient({ addresses: [{ host: 'localhost' }], clientInfoTag: 'my-app' }),
    );
    expect(config.clientInfoTag).toBe('my-app');
  });

  it('leaves a supplied client untouched instead of creating one', async () => {
    const supplied = { close: vi.fn() } as unknown as GlideClient;

    const client = new GlideValkeyClient(undefined, supplied);
    await client.connect();

    expect(GlideClient.createClient).not.toHaveBeenCalled();
  });
});
