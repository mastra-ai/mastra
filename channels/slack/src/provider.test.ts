import type { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { SlackManifestClient } from './client';
import { SlackProvider, stripTrailingSlash, resolveSlackAdapterConfig, hashConfig } from './provider';
import type { SlackConnectOptions } from './types';

describe('connect object form', () => {
  it('requires a name when connecting without an agent id', async () => {
    const provider = new SlackProvider();
    await expect(
      // @ts-expect-error deliberately omitting the required name to exercise the runtime guard
      provider.connect({ id: 'controller-1' }),
    ).rejects.toThrow(/"name" is required/);
  });
});

describe('stripTrailingSlash', () => {
  it('removes a single trailing slash', () => {
    expect(stripTrailingSlash('https://mastra-demo.calebbarnes.ca/')).toBe('https://mastra-demo.calebbarnes.ca');
  });

  it('removes multiple trailing slashes', () => {
    expect(stripTrailingSlash('https://example.com///')).toBe('https://example.com');
  });

  it('leaves a URL without a trailing slash unchanged', () => {
    expect(stripTrailingSlash('https://example.com')).toBe('https://example.com');
  });

  it('preserves path segments and only strips the trailing slash', () => {
    expect(stripTrailingSlash('https://example.com/base/')).toBe('https://example.com/base');
  });

  it('produces a clean OAuth callback URL when joined', () => {
    const baseUrl = stripTrailingSlash('https://mastra-demo.calebbarnes.ca/');
    expect(`${baseUrl}/slack/oauth/callback`).toBe('https://mastra-demo.calebbarnes.ca/slack/oauth/callback');
  });
});

describe('resolveSlackAdapterConfig', () => {
  it('carries textFormat through to the resolved adapter config', () => {
    const resolved = resolveSlackAdapterConfig({ textFormat: 'plain' });
    expect(resolved.textFormat).toBe('plain');
  });

  it('omits textFormat when unset so the core default governs', () => {
    const resolved = resolveSlackAdapterConfig({});
    expect('textFormat' in resolved).toBe(false);
  });
});

describe('connect config hash', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores a hash that config drift detection reproduces from the stored installation', async () => {
    vi.spyOn(SlackManifestClient.prototype, 'createApp').mockResolvedValue({
      appId: 'A1',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      signingSecret: 'signing-secret',
      oauthAuthorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=client-id',
    } as Awaited<ReturnType<SlackManifestClient['createApp']>>);

    const store = new InMemoryStore();
    const provider = new SlackProvider({
      baseUrl: 'https://example.com',
      tokenResolver: async () => 'token',
      encryptionKey: 'k'.repeat(32),
    });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => ({ name: 'Helper', getDescription: () => 'Helps' }),
    } as unknown as Mastra);

    await provider.connect({
      id: 'agent-1',
      name: 'Helper',
      description: 'Helps',
      slashCommands: ['/ask', { command: '/summarize', description: 'Summarize a thread' }],
    });

    const channels = (await store.getStore('channels'))!;
    const [record] = (await channels.listInstallations('slack')) as Array<{
      configHash?: string;
      data: { slashCommands?: SlackConnectOptions['slashCommands'] };
    }>;

    expect(record?.configHash).toBe(
      hashConfig({ slashCommands: record!.data.slashCommands }, 'https://example.com', 'Helper', 'Helps'),
    );
  });
});
