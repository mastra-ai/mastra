import { describe, expect, it, vi } from 'vitest';
import { createRepoTemplate } from './repo-template.js';
import { serializeSandboxTemplate } from './template.js';

describe('createRepoTemplate', () => {
  it('is side-effect-free until the lazy definition is resolved', async () => {
    const resolveHead = vi.fn().mockResolvedValue('0123456789abcdef0123456789abcdef01234567');
    const resolveTemplate = createRepoTemplate({
      repoFullName: 'acme/widgets',
      setupCommand: 'pnpm install --frozen-lockfile',
      resolveHead,
    });

    expect(resolveHead).not.toHaveBeenCalled();

    const template = await resolveTemplate();

    expect(resolveHead).toHaveBeenCalledWith('acme/widgets');
    expect(serializeSandboxTemplate(template!)).toEqual({
      schemaVersion: 1,
      operations: [
        {
          method: 'runCmd',
          args: [
            [
              'git clone https://github.com/acme/widgets.git "$HOME/widgets"',
              'git -C "$HOME/widgets" fetch origin 0123456789abcdef0123456789abcdef01234567',
              'git -C "$HOME/widgets" checkout 0123456789abcdef0123456789abcdef01234567',
              'cd "$HOME/widgets" && pnpm install --frozen-lockfile',
            ],
          ],
        },
      ],
      lineageId: 'repo:acme/widgets:$HOME/widgets',
    });
  });

  it('produces a commit-independent lineageId derived from repoFullName + workdir', async () => {
    const sha1 = '0123456789abcdef0123456789abcdef01234567';
    const sha2 = 'fedcba9876543210fedcba9876543210fedcba98';
    const a = await createRepoTemplate({ repoFullName: 'acme/widgets', sha: sha1 })();
    const b = await createRepoTemplate({ repoFullName: 'acme/widgets', sha: sha2 })();
    expect(serializeSandboxTemplate(a!).lineageId).toBe('repo:acme/widgets:$HOME/widgets');
    expect(serializeSandboxTemplate(a!).lineageId).toBe(serializeSandboxTemplate(b!).lineageId);

    const other = await createRepoTemplate({ repoFullName: 'acme/other', sha: sha1 })();
    const custom = await createRepoTemplate({
      repoFullName: 'acme/widgets',
      sha: sha1,
      workdir: '/workspace/w',
    })();
    expect(serializeSandboxTemplate(other!).lineageId).not.toBe(serializeSandboxTemplate(a!).lineageId);
    expect(serializeSandboxTemplate(custom!).lineageId).not.toBe(serializeSandboxTemplate(a!).lineageId);
  });

  it('returns undefined when a public head cannot be resolved so sandbox creation can fall back cold', async () => {
    const resolveTemplate = createRepoTemplate({
      repoFullName: 'acme/private-repo',
      resolveHead: vi.fn().mockResolvedValue(undefined),
    });

    await expect(resolveTemplate()).resolves.toBeUndefined();
  });

  it('uses an explicit commit without resolving the repository head', async () => {
    const resolveHead = vi.fn();
    const resolveTemplate = createRepoTemplate({
      repoFullName: 'acme/widgets',
      sha: 'abcdef1',
      workdir: '/workspace/widgets',
      resolveHead,
    });

    const template = await resolveTemplate();

    expect(resolveHead).not.toHaveBeenCalled();
    expect(serializeSandboxTemplate(template!).operations[0]).toEqual({
      method: 'runCmd',
      args: [
        [
          'git clone https://github.com/acme/widgets.git "/workspace/widgets"',
          'git -C "/workspace/widgets" fetch origin abcdef1',
          'git -C "/workspace/widgets" checkout abcdef1',
        ],
      ],
    });
  });

  it('rejects invalid repository, sha, and workdir inputs before returning a resolver', () => {
    expect(() => createRepoTemplate({ repoFullName: 'not-a-repo' })).toThrow("Invalid repoFullName 'not-a-repo'");
    expect(() => createRepoTemplate({ repoFullName: 'acme/widgets', sha: 'main' })).toThrow("Invalid sha 'main'");
    expect(() => createRepoTemplate({ repoFullName: 'acme/widgets', workdir: '$HOME/../escape' })).toThrow(
      "Invalid workdir '$HOME/../escape'",
    );
  });
});
