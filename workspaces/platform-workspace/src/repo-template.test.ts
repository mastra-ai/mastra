import { describe, expect, it, vi } from 'vitest';
import { createRepoTemplate } from './repo-template.js';
import { serializeSandboxTemplate } from './template.js';

const SHA_1 = '0123456789abcdef0123456789abcdef01234567';
const SHA_2 = 'fedcba9876543210fedcba9876543210fedcba98';

function accessFor(cloneUrl: string) {
  return async () => ({ cloneUrl });
}

describe('createRepoTemplate', () => {
  it('is side-effect-free until the lazy definition is resolved', async () => {
    const resolveHead = vi.fn().mockResolvedValue(SHA_1);
    const getRepositoryAccess = vi.fn(async () => ({ cloneUrl: 'https://github.com/acme/widgets.git' }));
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess,
      setupCommand: 'pnpm install --frozen-lockfile',
      resolveHead,
    })!;

    expect(getRepositoryAccess).not.toHaveBeenCalled();
    expect(resolveHead).not.toHaveBeenCalled();

    const template = await resolveTemplate();

    // The head resolve runs against the normalized clone URL (no `.git`).
    expect(resolveHead).toHaveBeenCalledWith('https://github.com/acme/widgets');
    expect(serializeSandboxTemplate(template!)).toEqual({
      schemaVersion: 1,
      operations: [
        {
          method: 'runCmd',
          args: [
            [
              'git clone https://github.com/acme/widgets "$HOME/widgets"',
              `git -C "$HOME/widgets" fetch origin ${SHA_1}`,
              `git -C "$HOME/widgets" checkout ${SHA_1}`,
              'cd "$HOME/widgets" && pnpm install --frozen-lockfile',
            ],
          ],
        },
      ],
      family: 'repo:https://github.com/acme/widgets:$HOME/widgets',
    });
  });

  it('produces a commit-independent family key derived from the clone URL + workdir', async () => {
    const a = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      sha: SHA_1,
    })!();
    const b = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      sha: SHA_2,
    })!();
    expect(serializeSandboxTemplate(a!).family).toBe('repo:https://github.com/acme/widgets:$HOME/widgets');
    expect(serializeSandboxTemplate(a!).family).toBe(serializeSandboxTemplate(b!).family);

    const other = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/other.git'),
      sha: SHA_1,
    })!();
    const custom = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      sha: SHA_1,
      workdir: '/workspace/w',
    })!();
    expect(serializeSandboxTemplate(other!).family).not.toBe(serializeSandboxTemplate(a!).family);
    expect(serializeSandboxTemplate(custom!).family).not.toBe(serializeSandboxTemplate(a!).family);
  });

  it('normalizes clone URL spellings so one repository has one family', async () => {
    const canonical = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets'),
      sha: SHA_1,
    })!();
    const spelled = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://GitHub.com/acme/widgets.git/'),
      sha: SHA_1,
    })!();
    expect(serializeSandboxTemplate(spelled!)).toEqual(serializeSandboxTemplate(canonical!));
  });

  it('returns undefined when a public head cannot be resolved so sandbox creation can fall back cold', async () => {
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/private-repo.git'),
      resolveHead: vi.fn().mockResolvedValue(undefined),
    })!;

    await expect(resolveTemplate()).resolves.toBeUndefined();
  });

  it('returns undefined for a repo-less context so the call site needs no conditional', () => {
    // Mirrors @mastra/e2b's createRepoTemplate: the whole FactorySandboxContext
    // passes straight through, and a session with no repository asks for the
    // provider default template.
    const ctx = { sessionId: 'session-1', setupCommand: 'pnpm install', getRepositoryAccess: undefined };
    expect(createRepoTemplate(ctx)).toBeUndefined();
  });

  it('degrades to undefined when repository access rejects or yields no clone URL', async () => {
    const rejecting = createRepoTemplate({
      getRepositoryAccess: vi.fn(async () => {
        throw new Error('access minting failed');
      }),
      sha: SHA_1,
    })!;
    await expect(rejecting()).resolves.toBeUndefined();

    const empty = createRepoTemplate({
      getRepositoryAccess: vi.fn(async () => undefined),
      sha: SHA_1,
    })!;
    await expect(empty()).resolves.toBeUndefined();
  });

  it('does not use the repository credential (build stays credential-free until platform build secrets exist)', async () => {
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: async () => ({
        cloneUrl: 'https://github.com/acme/widgets.git',
        authorization: { scheme: 'bearer' as const, token: 'ghs_secret_token' },
      }),
      sha: SHA_1,
    })!;

    const template = await resolveTemplate();

    // The token must appear nowhere in the serialized (content-addressed,
    // persisted) definition.
    expect(JSON.stringify(serializeSandboxTemplate(template!))).not.toContain('ghs_secret_token');
  });

  it('rejects a hostile clone URL instead of interpolating it into build commands', async () => {
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets";rm -rf /"'),
      sha: SHA_1,
    })!;
    await expect(resolveTemplate()).resolves.toBeUndefined();
  });

  it('uses an explicit commit without resolving the repository head', async () => {
    const resolveHead = vi.fn();
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      sha: 'abcdef1',
      workdir: '/workspace/widgets',
      resolveHead,
    })!;

    const template = await resolveTemplate();

    expect(resolveHead).not.toHaveBeenCalled();
    expect(serializeSandboxTemplate(template!).operations[0]).toEqual({
      method: 'runCmd',
      args: [
        [
          'git clone https://github.com/acme/widgets "/workspace/widgets"',
          'git -C "/workspace/widgets" fetch origin abcdef1',
          'git -C "/workspace/widgets" checkout abcdef1',
        ],
      ],
    });
  });

  it('rejects invalid sha and workdir inputs before returning a resolver', () => {
    const getRepositoryAccess = accessFor('https://github.com/acme/widgets.git');
    expect(() => createRepoTemplate({ getRepositoryAccess, sha: 'main' })).toThrow("Invalid sha 'main'");
    expect(() => createRepoTemplate({ getRepositoryAccess, workdir: '$HOME/../escape' })).toThrow(
      "Invalid workdir '$HOME/../escape'",
    );
  });
});
