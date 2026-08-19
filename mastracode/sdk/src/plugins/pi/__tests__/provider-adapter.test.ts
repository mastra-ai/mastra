import { describe, expect, it, vi } from 'vitest';

import { PiProviderAdapter } from '../provider-adapter.js';
import { MastraPiExtensionGeneration } from '../runtime.js';

describe('Pi provider adapter', () => {
  it('flushes load-time provider registrations only after runtime binding', async () => {
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    generation.createApi().registerProvider('proxy', { baseUrl: 'https://proxy.example.com', models: ['one'] });
    const registerProvider = vi.fn().mockResolvedValue(undefined);
    await generation.bind({ registerProvider });
    expect(registerProvider).toHaveBeenCalledWith('proxy', { baseUrl: 'https://proxy.example.com', models: ['one'] });
  });

  it('registers declarative providers, refreshes models, resolves collisions, and awaits teardown', async () => {
    const teardown = vi.fn().mockResolvedValue(undefined);
    const host = { register: vi.fn().mockResolvedValue(teardown), refresh: vi.fn().mockResolvedValue(undefined) };
    const adapter = new PiProviderAdapter(host);
    const first = new MastraPiExtensionGeneration('first', 'first', '/tmp/first.ts');
    const second = new MastraPiExtensionGeneration('second', 'second', '/tmp/second.ts');

    await adapter.register(first, 'proxy', {
      baseUrl: 'https://proxy.example.com',
      apiKey: '$PROXY_API_KEY',
      models: [{ id: 'fast' }, 'smart'],
    });
    await adapter.register(second, 'proxy', { baseUrl: 'https://other.example.com', models: ['other'] });
    expect(host.register).toHaveBeenCalledOnce();
    expect(host.register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'proxy',
        url: 'https://proxy.example.com',
        apiKeyEnvVar: 'PROXY_API_KEY',
        models: ['fast', 'smart'],
      }),
    );
    expect(
      second.compatibility.diagnostics.some(diagnostic => diagnostic.message.includes('first registration wins')),
    ).toBe(true);

    await first.invalidate();
    expect(teardown).toHaveBeenCalledOnce();
    expect(host.refresh).toHaveBeenCalledTimes(2);
  });

  it('awaits and cleans up in-flight provider registration during invalidation', async () => {
    let release!: () => void;
    const teardown = vi.fn().mockResolvedValue(undefined);
    const host = {
      register: vi.fn(
        () =>
          new Promise<() => Promise<void>>(resolve => {
            release = () => resolve(teardown);
          }),
      ),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new PiProviderAdapter(host);
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    await generation.bind({ registerProvider: (name, config) => adapter.register(generation, String(name), config) });
    generation.createApi().registerProvider('slow', { baseUrl: 'https://slow.example.com', models: ['one'] });
    await vi.waitUntil(() => release !== undefined);
    const invalidation = generation.invalidate();
    release();
    await invalidation;
    expect(teardown).toHaveBeenCalledOnce();
  });

  it('keeps an existing Mastra Code provider on collision', async () => {
    const host = {
      register: vi.fn().mockRejectedValue(new Error('Custom provider already exists: proxy')),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = new PiProviderAdapter(host);
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    await expect(
      adapter.register(generation, 'proxy', { baseUrl: 'https://proxy.example.com', models: ['one'] }),
    ).resolves.toBeUndefined();
    expect(
      generation.compatibility.diagnostics.some(diagnostic => diagnostic.message.includes('Mastra Code provider wins')),
    ).toBe(true);
    expect(host.refresh).not.toHaveBeenCalled();
  });

  it('rejects literal credentials even when their value matches a host environment variable', async () => {
    vi.stubEnv('PI_MATCHING_SECRET', 'secret-value');
    const host = { register: vi.fn().mockResolvedValue(undefined), refresh: vi.fn().mockResolvedValue(undefined) };
    const adapter = new PiProviderAdapter(host);
    const generation = new MastraPiExtensionGeneration('plugin', 'ext', '/tmp/entry.ts');

    await adapter.register(generation, 'raw-secret', {
      baseUrl: 'https://secret.example.com',
      apiKey: 'secret-value',
      models: ['one'],
    });
    await adapter.register(generation, 'empty-reference', {
      baseUrl: 'https://secret.example.com',
      apiKey: '$',
      models: ['one'],
    });
    await adapter.register(generation, 'invalid-reference', {
      baseUrl: 'https://secret.example.com',
      apiKey: '$NOT-VALID',
      models: ['one'],
    });

    expect(host.register).not.toHaveBeenCalled();
    expect(generation.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'registerProvider:credential' }),
    );
    vi.unstubAllEnvs();
  });

  it('preserves the first same-generation provider registration', async () => {
    const host = { register: vi.fn().mockResolvedValue(undefined), refresh: vi.fn().mockResolvedValue(undefined) };
    const adapter = new PiProviderAdapter(host);
    const generation = new MastraPiExtensionGeneration('plugin', 'ext', '/tmp/entry.ts');

    await adapter.register(generation, 'stable', { baseUrl: 'https://one.example.com', models: ['one'] });
    await adapter.register(generation, 'stable', { baseUrl: 'https://two.example.com', models: ['two'] });

    expect(host.register).toHaveBeenCalledOnce();
    expect(host.register).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://one.example.com' }));
    expect(generation.compatibility.diagnostics).toContainEqual(
      expect.objectContaining({
        capability: 'registerProvider',
        message: expect.stringContaining('first registration wins'),
      }),
    );
  });

  it('diagnoses OAuth and rejects native provider registration through the runtime', async () => {
    const host = { register: vi.fn().mockResolvedValue(undefined), refresh: vi.fn().mockResolvedValue(undefined) };
    const adapter = new PiProviderAdapter(host);
    const generation = new MastraPiExtensionGeneration('plugin', 'extension', '/tmp/entry.ts');
    await adapter.register(generation, 'oauth', {
      baseUrl: 'https://oauth.example.com',
      models: ['one'],
      oauth: { login: true },
    });
    expect(
      generation.compatibility.diagnostics.some(diagnostic => diagnostic.capability === 'registerProvider:oauth'),
    ).toBe(true);

    await adapter.register(generation, 'raw-secret', {
      baseUrl: 'https://secret.example.com',
      apiKey: 'not-an-environment-credential',
      models: ['one'],
    });
    expect(
      generation.compatibility.diagnostics.some(diagnostic => diagnostic.capability === 'registerProvider:credential'),
    ).toBe(true);

    generation.createApi().registerProvider({ id: 'native' });
    expect(generation.compatibility.capabilities.some(capability => capability.name === 'registerNativeProvider')).toBe(
      true,
    );
    expect(host.register).not.toHaveBeenCalled();
  });
});
