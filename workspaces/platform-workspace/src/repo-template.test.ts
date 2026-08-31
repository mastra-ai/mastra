import { describe, expect, it, vi } from 'vitest';

import { createRepoTemplate, resolveDefaultBranchHead } from './repo-template.js';
import { getSandboxTemplateBuildEnvs, serializeSandboxTemplate } from './template.js';

const SHA_1 = '0123456789abcdef0123456789abcdef01234567';
const SHA_2 = 'fedcba9876543210fedcba9876543210fedcba98';

function accessFor(cloneUrl: string) {
  return async () => ({ cloneUrl });
}

function headOf(sha: string) {
  return vi.fn().mockResolvedValue(sha);
}

describe('createRepoTemplate', () => {
  it('is side-effect-free until the lazy definition is resolved', async () => {
    const resolveHead = headOf(SHA_1);
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

  it('threads cpuCount and memoryMB into the template as resource operations', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: headOf(SHA_1),
      cpuCount: 4,
      memoryMB: 8_192,
    })!();

    const serialized = serializeSandboxTemplate(template!);
    expect(serialized.operations).toEqual([
      { method: 'cpuCount', args: [4] },
      { method: 'memoryMB', args: [8_192] },
      {
        method: 'runCmd',
        args: [
          [
            'git clone https://github.com/acme/widgets "$HOME/widgets"',
            `git -C "$HOME/widgets" fetch origin ${SHA_1}`,
            `git -C "$HOME/widgets" checkout ${SHA_1}`,
          ],
        ],
      },
    ]);
    // Sizing never leaks into the commit-independent family key; the platform
    // namespaces warm fallbacks by size server-side.
    expect(serialized.family).toBe('repo:https://github.com/acme/widgets:$HOME/widgets');
  });

  it('omits resource operations entirely when sizing is not requested', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: headOf(SHA_1),
    })!();
    const methods = serializeSandboxTemplate(template!).operations.map(operation => operation.method);
    expect(methods).not.toContain('cpuCount');
    expect(methods).not.toContain('memoryMB');
  });

  it('produces a commit-independent family key derived from the clone URL + workdir', async () => {
    const a = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: headOf(SHA_1),
    })!();
    const b = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: headOf(SHA_2),
    })!();
    expect(serializeSandboxTemplate(a!).family).toBe('repo:https://github.com/acme/widgets:$HOME/widgets');
    expect(serializeSandboxTemplate(a!).family).toBe(serializeSandboxTemplate(b!).family);

    const other = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/other.git'),
      resolveHead: headOf(SHA_1),
    })!();
    expect(serializeSandboxTemplate(other!).family).not.toBe(serializeSandboxTemplate(a!).family);
  });

  it('normalizes clone URL spellings so one repository has one family', async () => {
    const canonical = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets'),
      resolveHead: headOf(SHA_1),
    })!();
    const spelled = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://GitHub.com/acme/widgets.git/'),
      resolveHead: headOf(SHA_1),
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

  it('rejects a malformed resolved head instead of interpolating it into build commands', async () => {
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: headOf('main; rm -rf /'),
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
      resolveHead: headOf(SHA_1),
    })!;
    await expect(rejecting()).resolves.toBeUndefined();

    const empty = createRepoTemplate({
      getRepositoryAccess: vi.fn(async () => undefined),
      resolveHead: headOf(SHA_1),
    })!;
    await expect(empty()).resolves.toBeUndefined();
  });

  it('keeps the repository token out of git process arguments while resolving the default branch', async () => {
    const execute = vi.fn(
      async (
        _file: string,
        _args: string[],
        _options: { timeout: number; maxBuffer: number; env: Record<string, string | undefined> },
      ) => ({ stdout: `${SHA_1}\tHEAD\n` }),
    );

    await expect(
      resolveDefaultBranchHead('https://github.com/acme/widgets', 'ghs_secret_token', execute),
    ).resolves.toBe(SHA_1);

    const [file, args, options] = execute.mock.calls[0]!;
    expect(file).toBe('git');
    expect(args).toEqual(['ls-remote', '--', 'https://github.com/acme/widgets', 'HEAD']);
    expect(JSON.stringify(args)).not.toContain('ghs_secret_token');
    expect(options.env).toMatchObject({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.extraheader',
      GIT_TERMINAL_PROMPT: '0',
    });
    expect(options.env.GIT_CONFIG_VALUE_0).not.toContain('ghs_secret_token');
  });

  it('uses repository credentials only as transient build envs', async () => {
    const resolveHead = headOf(SHA_1);
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: async () => ({
        cloneUrl: 'https://github.com/acme/widgets.git',
        authorization: { scheme: 'bearer' as const, token: 'ghs_secret_token' },
      }),
      resolveHead,
    })!;

    const template = await resolveTemplate();
    const definition = serializeSandboxTemplate(template!);

    expect(resolveHead).toHaveBeenCalledWith('https://github.com/acme/widgets', 'ghs_secret_token');
    expect(getSandboxTemplateBuildEnvs(template!)).toEqual({
      MASTRA_REPOSITORY_ACCESS_TOKEN: 'ghs_secret_token',
    });
    expect(definition.operations[0]).toEqual({
      method: 'runCmd',
      args: [
        [
          expect.stringContaining('$MASTRA_REPOSITORY_ACCESS_TOKEN'),
          expect.stringContaining('$MASTRA_REPOSITORY_ACCESS_TOKEN'),
          `git -C "$HOME/widgets" checkout ${SHA_1}`,
        ],
      ],
    });
    expect(JSON.stringify(definition)).not.toContain('ghs_secret_token');
  });

  it('rejects a hostile clone URL instead of interpolating it into build commands', async () => {
    const resolveHead = headOf(SHA_1);
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets";rm -rf /"'),
      resolveHead,
    })!;
    await expect(resolveTemplate()).resolves.toBeUndefined();
    // Rejected before any network work.
    expect(resolveHead).not.toHaveBeenCalled();
  });
});
