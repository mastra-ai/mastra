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
      source: {
        type: 'git',
        familyId: expect.stringMatching(/^[a-f0-9]{64}$/),
        commitSha: '0123456789abcdef0123456789abcdef01234567',
      },
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
    });
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
    const definition = serializeSandboxTemplate(template!);

    expect(resolveHead).not.toHaveBeenCalled();
    expect(definition.source).toEqual({
      type: 'git',
      familyId: expect.stringMatching(/^[a-f0-9]{64}$/),
      commitSha: 'abcdef1',
    });
    expect(definition.operations[0]).toEqual({
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

  it('keeps a repository family stable across commits and changes it for build configuration', async () => {
    const first = await createRepoTemplate({
      repoFullName: 'acme/widgets',
      sha: 'abcdef1',
      setupCommand: 'pnpm install',
    })();
    const nextCommit = await createRepoTemplate({
      repoFullName: 'acme/widgets',
      sha: 'abcdef2',
      setupCommand: 'pnpm install',
    })();
    const changedSetup = await createRepoTemplate({
      repoFullName: 'acme/widgets',
      sha: 'abcdef2',
      setupCommand: 'pnpm install --frozen-lockfile',
    })();

    const firstSource = serializeSandboxTemplate(first!).source;
    const nextSource = serializeSandboxTemplate(nextCommit!).source;
    const changedSource = serializeSandboxTemplate(changedSetup!).source;

    expect(firstSource?.familyId).toBe(nextSource?.familyId);
    expect(firstSource?.commitSha).toBe('abcdef1');
    expect(nextSource?.commitSha).toBe('abcdef2');
    expect(changedSource?.familyId).not.toBe(firstSource?.familyId);

    const extended = first!.runCmd('pnpm test');
    expect(serializeSandboxTemplate(extended).source?.familyId).not.toBe(firstSource?.familyId);
  });

  it('marks stale-while-revalidate only when runtime checkout reconciliation is enabled', async () => {
    const exact = await createRepoTemplate({ repoFullName: 'acme/widgets', sha: 'abcdef1' })();
    const reconciled = await createRepoTemplate({
      repoFullName: 'acme/widgets',
      sha: 'abcdef1',
      staleWhileRevalidate: true,
    })();

    expect(serializeSandboxTemplate(exact!).source).not.toHaveProperty('staleWhileRevalidate');
    expect(serializeSandboxTemplate(reconciled!).source).toMatchObject({ staleWhileRevalidate: true });
    expect(reconciled!.id()).toBe(exact!.id());
  });

  it('rejects invalid repository, sha, and workdir inputs before returning a resolver', () => {
    expect(() => createRepoTemplate({ repoFullName: 'not-a-repo' })).toThrow("Invalid repoFullName 'not-a-repo'");
    expect(() => createRepoTemplate({ repoFullName: 'acme/widgets', sha: 'main' })).toThrow("Invalid sha 'main'");
    expect(() => createRepoTemplate({ repoFullName: 'acme/widgets', workdir: '$HOME/../escape' })).toThrow(
      "Invalid workdir '$HOME/../escape'",
    );
  });
});
