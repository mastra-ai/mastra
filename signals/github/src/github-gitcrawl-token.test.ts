import type { StorageThreadType } from '@mastra/core/memory';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const execFile = () => undefined;
  Object.defineProperty(execFile, Symbol.for('nodejs.util.promisify.custom'), { value: execFileAsync });
  return { ...actual, execFile };
});

import { GithubAppOwnerResolver } from './github-app-owner.js';
import { GitcrawlSyncClient, GithubSignals, GITHUB_SIGNALS_METADATA_KEY } from './index.js';
import type { GithubPullRequestSnapshot, GithubSignalsSyncClient, GithubSignalsThreadStore } from './index.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

type MockedCommand = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

/**
 * Stub the `gh` and `gitcrawl` commands these tests drive. Keys are matched as
 * prefixes of `file argv...`, longest first; anything unmatched fails the test.
 */
function mockCommands(handlers: Record<string, () => Promise<{ stdout: string; stderr: string }>>) {
  const keys = Object.keys(handlers).sort((a, b) => b.length - a.length);
  execFileAsync.mockImplementation(async (file: string, args: string[]) => {
    const joined = `${file} ${args.join(' ')}`;
    const key = keys.find(candidate => joined === candidate || joined.startsWith(`${candidate} `));
    if (!key) throw new Error(`Unexpected command: ${joined}`);
    return handlers[key]!();
  });
}

const ok = (stdout: string) => async () => ({ stdout, stderr: '' });
const freshToken = (token: string) => ok(`${token}\n`);

const envOf = (file: string, joinedArgs: string) =>
  execFileAsync.mock.calls.find(call => call[0] === file && call[1].join(' ') === joinedArgs)?.[2]?.env;

function createThreadStore(thread: StorageThreadType): GithubSignalsThreadStore {
  let current = thread;
  return {
    getThreadById: vi.fn(async () => current),
    saveThread: vi.fn(async ({ thread: next }: { thread: StorageThreadType }) => {
      current = next;
      return next;
    }),
  };
}

function createSubscribedThread(): StorageThreadType {
  return {
    id: 'thread-credential',
    resourceId: 'resource-credential',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {
      mastra: {
        [GITHUB_SIGNALS_METADATA_KEY]: {
          subscriptions: [
            {
              owner: 'mastra-ai',
              repo: 'mastra',
              number: 123,
              subscribedAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'signal-1',
            },
          ],
        },
      },
    },
  };
}

describe('GitcrawlSyncClient GitHub credential injection', () => {
  it('injects a fresh gh credential into gitcrawl sync, overriding stale token variables', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_stale');
    vi.stubEnv('GITHUB_TOKEN', 'ghp_stale');
    mockCommands({ 'gh auth token': freshToken('gho_fresh'), 'gitcrawl sync': ok('{}') });

    const result = await new GitcrawlSyncClient().syncPullRequest({
      owner: 'mastra-ai',
      repo: 'mastra',
      number: 12345,
    });

    expect(result).toEqual({ ok: true, stdout: '{}', stderr: '' });

    // gitcrawl's env lookup wins outright, so the stale value is never consulted.
    expect(execFileAsync.mock.calls.find(call => call[0] === 'gitcrawl')?.[1]).toEqual([
      'sync',
      'mastra-ai/mastra',
      '--numbers',
      '12345',
      '--include-comments',
      '--with',
      'pr-details',
      '--json',
    ]);
    const env = execFileAsync.mock.calls.find(call => call[0] === 'gitcrawl')?.[2].env;
    expect(env.GH_TOKEN).toBe('gho_fresh');
    expect(env.GITHUB_TOKEN).toBe('gho_fresh');
  });

  it('asks gh for the credential with the token variables removed', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_stale');
    vi.stubEnv('GITHUB_TOKEN', 'ghp_stale');
    mockCommands({ 'gh auth token': freshToken('gho_fresh'), 'gitcrawl sync': ok('{}') });

    await new GitcrawlSyncClient().syncPullRequest({ owner: 'mastra-ai', repo: 'mastra', number: 1 });

    // Otherwise gh answers with the stale variable verbatim and hands back the
    // very credential being replaced.
    const env = envOf('gh', 'auth token');
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  it.each([
    ['fails', async () => Promise.reject(new Error('gh failed'))],
    ['returns nothing', ok('\n')],
  ])('leaves the inherited environment untouched when gh %s', async (_name, ghHandler) => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_from_user');
    mockCommands({ 'gh auth token': ghHandler, 'gitcrawl sync': ok('{}') });

    const result = await new GitcrawlSyncClient().syncPullRequest({ owner: 'mastra-ai', repo: 'mastra', number: 1 });

    expect(result?.ok).toBe(true);
    // No credential to offer, so a working inherited token must survive.
    expect(execFileAsync.mock.calls.find(call => call[0] === 'gitcrawl')?.[2].env).toBeUndefined();
  });
});

describe('GithubAppOwnerResolver GitHub credential injection', () => {
  it('resolves an app owner with a fresh credential through the default gh runner', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_stale');
    mockCommands({
      'gh auth token': freshToken('gho_fresh'),
      'gh api apps/coderabbitai': ok(JSON.stringify({ owner: { login: 'mastra-ai', type: 'Organization' } })),
    });

    await expect(new GithubAppOwnerResolver().getOwner('coderabbitai[bot]')).resolves.toEqual({
      login: 'mastra-ai',
      type: 'Organization',
    });

    // A stale token made this call exit 1, which getOwner swallows into
    // `undefined` and authorization reads as "not authorized".
    expect(envOf('gh', 'api apps/coderabbitai')?.GH_TOKEN).toBe('gho_fresh');
  });
});

describe('GithubSignals permission lookup GitHub credential injection', () => {
  it('resolves the author permission with a fresh credential when no resolver is configured', async () => {
    vi.stubEnv('GH_TOKEN', 'ghp_stale');
    mockCommands({
      'gh auth token': freshToken('gho_fresh'),
      'gh api repos/mastra-ai/mastra/collaborators/contributor/permission --jq .permission': ok('write\n'),
    });

    const thread = createSubscribedThread();
    const syncClient: GithubSignalsSyncClient = {
      syncPullRequest: vi.fn(async () => ({ ok: true })),
      getPullRequestSnapshot: vi.fn(
        async () =>
          ({
            title: 'Add GitHub signals',
            state: 'open',
            githubUpdatedAt: '2026-01-01T00:05:00.000Z',
            contentHash: 'credential-hash',
            latestCommentAuthor: 'contributor',
          }) satisfies GithubPullRequestSnapshot,
      ),
    };
    // No permissionResolver: exercise the default `gh api` branch.
    const processor = new GithubSignals({ threadStore: createThreadStore(thread), syncClient });
    processor.addAgent({ sendSignal: vi.fn(), sendNotificationSignal: vi.fn(async () => ({ accepted: true })) });

    await processor.syncThreadNow({ threadId: thread.id, resourceId: thread.resourceId });

    const env = envOf('gh', 'api repos/mastra-ai/mastra/collaborators/contributor/permission --jq .permission');
    expect(env?.GH_TOKEN).toBe('gho_fresh');
    expect(env?.GITHUB_TOKEN).toBe('gho_fresh');
  });
});
