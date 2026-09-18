import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const execFile = () => undefined;
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), { value: execFileAsync });
  return { ...actual, execFile };
});

import { GitcrawlSyncClient } from './index.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

/** Stub `gh auth token` and `gitcrawl`; any other command fails the test. */
function mockCommands(ghToken?: string) {
  execFileAsync.mockImplementation(async (file: string, args: string[]) => {
    if (file === 'gh' && args.join(' ') === 'auth token') {
      if (ghToken === undefined) throw new Error('gh auth token failed');
      return { stdout: `${ghToken}\n`, stderr: '' };
    }
    if (file === 'gitcrawl') return { stdout: '{}', stderr: '' };
    throw new Error(`Unexpected command: ${file} ${args.join(' ')}`);
  });
}

const callFor = (file: string) => execFileAsync.mock.calls.find(call => call[0] === file);

describe('GitcrawlSyncClient GitHub credential injection', () => {
  it('injects a fresh gh credential into gitcrawl sync, overriding stale token variables', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_stale');
    vi.stubEnv('GITHUB_TOKEN', 'ghp_stale');
    mockCommands('gho_fresh');

    const result = await new GitcrawlSyncClient().syncPullRequest({
      owner: 'mastra-ai',
      repo: 'mastra',
      number: 12345,
    });

    expect(result).toEqual({ ok: true, stdout: '{}', stderr: '' });

    // gitcrawl's env lookup wins outright, so the stale value is never consulted.
    const syncCall = callFor('gitcrawl');
    expect(syncCall?.[1]).toEqual([
      'sync',
      'mastra-ai/mastra',
      '--numbers',
      '12345',
      '--include-comments',
      '--with',
      'pr-details',
      '--json',
    ]);
    expect(syncCall?.[2].env.GH_TOKEN).toBe('gho_fresh');
    expect(syncCall?.[2].env.GITHUB_TOKEN).toBe('gho_fresh');
  });

  it('asks gh for the credential with the token variables removed', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_stale');
    vi.stubEnv('GITHUB_TOKEN', 'ghp_stale');
    mockCommands('gho_fresh');

    await new GitcrawlSyncClient().syncPullRequest({ owner: 'mastra-ai', repo: 'mastra', number: 1 });

    // Otherwise gh answers with the stale variable verbatim and hands back the
    // very credential being replaced.
    const ghCall = callFor('gh');
    expect(ghCall?.[1]).toEqual(['auth', 'token']);
    expect(ghCall?.[2].env.GH_TOKEN).toBeUndefined();
    expect(ghCall?.[2].env.GITHUB_TOKEN).toBeUndefined();
  });

  it.each([
    ['fails', undefined],
    ['returns nothing', ''],
  ])('leaves the inherited environment untouched when gh %s', async (_name, ghToken) => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_from_user');
    mockCommands(ghToken);

    const result = await new GitcrawlSyncClient().syncPullRequest({ owner: 'mastra-ai', repo: 'mastra', number: 1 });

    expect(result?.ok).toBe(true);
    // No credential to offer, so a working inherited token must survive.
    expect(callFor('gitcrawl')?.[2].env).toBeUndefined();
  });
});
