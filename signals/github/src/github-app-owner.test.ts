import { afterEach, describe, expect, it, vi } from 'vitest';

import { GithubAppOwnerResolver } from './github-app-owner.js';
import type { GithubAppOwnerCommandRunner } from './github-app-owner.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('GithubAppOwnerResolver', () => {
  it('normalizes bot logins into app slugs and parses supported owners', async () => {
    const runGhApi = vi
      .fn<GithubAppOwnerCommandRunner>()
      .mockResolvedValueOnce({ stdout: JSON.stringify({ owner: { login: 'Acme', type: 'Organization' } }) })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ owner: { login: 'octocat', type: 'User' } }) });
    const resolver = new GithubAppOwnerResolver(runGhApi);

    await expect(resolver.getOwner('Acme-App[BoT]')).resolves.toEqual({ login: 'Acme', type: 'Organization' });
    await expect(resolver.getOwner('plain-app')).resolves.toEqual({ login: 'octocat', type: 'User' });
    await expect(resolver.getOwner('[bot]')).resolves.toBeUndefined();

    expect(runGhApi).toHaveBeenNthCalledWith(1, ['api', 'apps/Acme-App']);
    expect(runGhApi).toHaveBeenNthCalledWith(2, ['api', 'apps/plain-app']);
    expect(runGhApi).toHaveBeenCalledTimes(2);
  });

  it('caches successful lookups by lowercase app slug for 24 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const runGhApi = vi
      .fn<GithubAppOwnerCommandRunner>()
      .mockResolvedValue({ stdout: JSON.stringify({ owner: { login: 'mastra-ai', type: 'Organization' } }) });
    const resolver = new GithubAppOwnerResolver(runGhApi);

    await expect(resolver.getOwner('Mastra-Platform[bot]')).resolves.toEqual({
      login: 'mastra-ai',
      type: 'Organization',
    });
    vi.setSystemTime(new Date('2026-01-01T23:59:59.999Z'));
    await expect(resolver.getOwner('mastra-platform[BOT]')).resolves.toEqual({
      login: 'mastra-ai',
      type: 'Organization',
    });
    expect(runGhApi).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    await resolver.getOwner('mastra-platform[bot]');
    expect(runGhApi).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['command failure', () => Promise.reject(new Error('gh failed'))],
    ['malformed JSON', () => Promise.resolve({ stdout: '{' })],
    ['missing owner', () => Promise.resolve({ stdout: JSON.stringify({}) })],
    ['empty owner login', () => Promise.resolve({ stdout: JSON.stringify({ owner: { login: '', type: 'User' } }) })],
    [
      'unsupported owner type',
      () => Promise.resolve({ stdout: JSON.stringify({ owner: { login: 'github-actions', type: 'Bot' } }) }),
    ],
  ])('does not cache %s', async (_name, resultFactory) => {
    const runGhApi = vi.fn<GithubAppOwnerCommandRunner>().mockImplementation(resultFactory);
    const resolver = new GithubAppOwnerResolver(runGhApi);

    await expect(resolver.getOwner('unknown[bot]')).resolves.toBeUndefined();
    await expect(resolver.getOwner('unknown[bot]')).resolves.toBeUndefined();

    expect(runGhApi).toHaveBeenCalledTimes(2);
  });

  it('does not cache or return an owner after the polling generation becomes stale', async () => {
    let resolveCommand!: (result: { stdout: string }) => void;
    const runGhApi = vi.fn<GithubAppOwnerCommandRunner>().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveCommand = resolve;
        }),
    );
    const resolver = new GithubAppOwnerResolver(runGhApi);
    let current = true;

    const pending = resolver.getOwner('yoko-reviewer[bot]', () => current);
    current = false;
    resolveCommand({ stdout: JSON.stringify({ owner: { login: 'TylerBarnes', type: 'User' } }) });
    await expect(pending).resolves.toBeUndefined();

    current = true;
    const retry = resolver.getOwner('yoko-reviewer[bot]', () => current);
    expect(runGhApi).toHaveBeenCalledTimes(2);
    resolveCommand({ stdout: JSON.stringify({ owner: { login: 'TylerBarnes', type: 'User' } }) });
    await expect(retry).resolves.toEqual({ login: 'TylerBarnes', type: 'User' });
  });

  it('does not return a cached owner to a stale polling generation', async () => {
    const runGhApi = vi
      .fn<GithubAppOwnerCommandRunner>()
      .mockResolvedValue({ stdout: JSON.stringify({ owner: { login: 'mastra-ai', type: 'Organization' } }) });
    const resolver = new GithubAppOwnerResolver(runGhApi);

    await resolver.getOwner('mastra-platform[bot]');
    await expect(resolver.getOwner('mastra-platform[bot]', () => false)).resolves.toBeUndefined();
    expect(runGhApi).toHaveBeenCalledTimes(1);
  });
});
