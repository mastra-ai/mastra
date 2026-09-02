import { SETUP_MARKER_PATH, setupMarkerContent } from '@internal/workspace';
import { describe, expect, it, vi } from 'vitest';

import { createRepoTemplate, redactSecrets, resolveDefaultBranchHead } from './repo-template.js';
import { getSandboxTemplateBuildEnvs, serializeSandboxTemplate } from './template.js';

const SHA_1 = '0123456789abcdef0123456789abcdef01234567';
const SHA_2 = 'fedcba9876543210fedcba9876543210fedcba98';

function accessFor(cloneUrl: string) {
  return async () => ({ cloneUrl });
}

function headOf(sha: string) {
  return vi.fn().mockResolvedValue(sha);
}

/** The marker step every repo template ends with, for the commands it ran. */
function markerStep(...setupCommands: string[]) {
  const content = setupMarkerContent(setupCommands);
  return {
    method: 'runCmd',
    args: [`mkdir -p "$(dirname "${SETUP_MARKER_PATH}")" && printf '%s' '${content}' > "${SETUP_MARKER_PATH}"`],
  };
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
        { method: 'runCmd', args: ['git clone https://github.com/acme/widgets "widgets"'] },
        { method: 'runCmd', args: [`git -C "widgets" fetch origin ${SHA_1}`] },
        { method: 'runCmd', args: [`git -C "widgets" checkout ${SHA_1}`] },
        { method: 'runCmd', args: ['cd "widgets" && pnpm install --frozen-lockfile'] },
        markerStep('pnpm install --frozen-lockfile'),
      ],
      family: 'repo:https://github.com/acme/widgets:/widgets',
    });
  });

  it('always writes the setup marker beside the checkout as the last build step, digesting the commands it ran', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      setupCommand: ['pnpm i', '', 'pnpm build'],
      resolveHead: headOf(SHA_1),
    })!();
    const operations = serializeSandboxTemplate(template!).operations;
    expect(setupMarkerContent(['pnpm i', 'pnpm build'])).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(operations.at(-1)).toEqual(markerStep('pnpm i', 'pnpm build'));
    expect(operations.at(-2)).toEqual({ method: 'runCmd', args: ['cd "widgets" && pnpm build'] });
    expect(setupMarkerContent(['pnpm i'])).not.toBe(setupMarkerContent(['pnpm i', 'pnpm build']));
  });

  it('runs each setupCommand array entry as its own build step with its own cd prefix', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      setupCommand: ['pnpm i', 'pnpm build'],
      resolveHead: headOf(SHA_1),
    })!();

    const operations = serializeSandboxTemplate(template!).operations;
    expect(operations.slice(-3)).toEqual([
      { method: 'runCmd', args: ['cd "widgets" && pnpm i'] },
      { method: 'runCmd', args: ['cd "widgets" && pnpm build'] },
      markerStep('pnpm i', 'pnpm build'),
    ]);
  });

  it('drops blank setup entries instead of emitting broken cd-prefixed steps', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      setupCommand: ['pnpm i', '', '   '],
      resolveHead: headOf(SHA_1),
    })!();

    const operations = serializeSandboxTemplate(template!).operations;
    const setupOps = operations.filter(op => op.method === 'runCmd' && String(op.args[0]).startsWith('cd '));
    expect(setupOps).toEqual([{ method: 'runCmd', args: ['cd "widgets" && pnpm i'] }]);
  });

  it('treats an all-blank setupCommand as absent', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      setupCommand: '',
      resolveHead: headOf(SHA_1),
    })!();

    const operations = serializeSandboxTemplate(template!).operations;
    expect(operations.filter(op => op.method === 'runCmd')).toHaveLength(4);
    expect(operations.at(-1)).toEqual(markerStep());
  });

  it('creates an explicit workingDirectory, sets it as the cwd before cloning, and keys the family on it', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      setupCommand: 'pnpm i',
      workingDirectory: '/workspace/',
      resolveHead: headOf(SHA_1),
    })!();

    const serialized = serializeSandboxTemplate(template!);
    // mkdir runs as the build user, then setWorkdir makes the directory the
    // cwd for every later step and the runtime default. Steps stay relative
    // so the checkout lands at `<cwd>/widgets` exactly as in the unset case.
    expect(serialized.operations.slice(0, 3)).toEqual([
      { method: 'runCmd', args: ['mkdir -p "/workspace"'] },
      { method: 'setWorkdir', args: ['/workspace'] },
      { method: 'runCmd', args: ['git clone https://github.com/acme/widgets "widgets"'] },
    ]);
    const commands = serialized.operations.filter(op => op.method === 'runCmd').map(op => String(op.args[0]));
    expect(commands.at(-2)).toBe('cd "widgets" && pnpm i');
    expect(commands.at(-1)).toBe(markerStep('pnpm i').args[0]);
    expect(serialized.family).toBe('repo:https://github.com/acme/widgets:/workspace/widgets');
  });

  it('keeps steps relative to the base image cwd when workingDirectory is omitted', async () => {
    const template = await createRepoTemplate({
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: headOf(SHA_1),
    })!();

    const serialized = serializeSandboxTemplate(template!);
    expect(serialized.operations.map(op => op.method)).not.toContain('setWorkdir');
    expect(serialized.operations[0]).toEqual({
      method: 'runCmd',
      args: ['git clone https://github.com/acme/widgets "widgets"'],
    });
  });

  it('rejects a workingDirectory that is not a plain absolute path', async () => {
    for (const bad of ['~/repos', '$HOME/repos', 'relative', '/tmp/../etc']) {
      await expect(
        createRepoTemplate({
          getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
          workingDirectory: bad,
          resolveHead: headOf(SHA_1),
        })!(),
      ).rejects.toThrow(/absolute path/);
    }
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
      { method: 'runCmd', args: ['git clone https://github.com/acme/widgets "widgets"'] },
      { method: 'runCmd', args: [`git -C "widgets" fetch origin ${SHA_1}`] },
      { method: 'runCmd', args: [`git -C "widgets" checkout ${SHA_1}`] },
      markerStep(),
    ]);
    // Sizing never leaks into the commit-independent family key; the platform
    // namespaces warm fallbacks by size server-side.
    expect(serialized.family).toBe('repo:https://github.com/acme/widgets:/widgets');
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
    expect(serializeSandboxTemplate(a!).family).toBe('repo:https://github.com/acme/widgets:/widgets');
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

  it('keeps the requested resources when the repository template cannot be resolved', async () => {
    const sized = { cpuCount: 4, memoryMB: 8192 };
    const expected = {
      schemaVersion: 1,
      operations: [
        { method: 'cpuCount', args: [4] },
        { method: 'memoryMB', args: [8192] },
      ],
    };

    const noHead = await createRepoTemplate({
      ...sized,
      getRepositoryAccess: accessFor('https://github.com/acme/widgets.git'),
      resolveHead: vi.fn().mockRejectedValue(new Error('rate limited')),
    })!();
    expect(serializeSandboxTemplate(noHead!)).toEqual(expected);

    const noAccess = await createRepoTemplate({
      ...sized,
      getRepositoryAccess: vi.fn(async () => undefined),
      resolveHead: headOf(SHA_1),
    })!();
    expect(serializeSandboxTemplate(noAccess!)).toEqual(expected);

    const noRepo = await createRepoTemplate({ ...sized, getRepositoryAccess: undefined })!();
    expect(serializeSandboxTemplate(noRepo!)).toEqual(expected);
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

  it('redacts credentials from the bail warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let logged: string;
    try {
      await createRepoTemplate({
        getRepositoryAccess: vi.fn(async () => {
          throw new Error('401 for https://x-access-token:ghs_abc123@github.com/acme/widgets (Bearer ghp_zzz)');
        }),
        resolveHead: headOf(SHA_1),
      })!();
      await createRepoTemplate({
        getRepositoryAccess: async () => ({ cloneUrl: 'https://ghs_leak@github.com/acme/widgets.git' }),
        resolveHead: headOf(SHA_1),
      })!();
      logged = JSON.stringify(warn.mock.calls);
    } finally {
      warn.mockRestore();
    }

    expect(logged).not.toContain('ghs_abc123');
    expect(logged).not.toContain('ghp_zzz');
    expect(logged).not.toContain('ghs_leak');
    expect(logged).toContain('https://***@github.com/acme/widgets');
    expect(logged).toContain('401 for');
  });

  it('redactSecrets masks userinfo, authorization values, and token shapes', () => {
    expect(redactSecrets(new Error('https://user:pw@host/x Basic abc== github_pat_11AB_cd ghp_1234'))).toBe(
      'https://***@host/x Basic *** github_pat_*** ghp_***',
    );
    expect(redactSecrets(undefined)).toBeUndefined();
    expect(redactSecrets({ code: 1 })).toBe('[object Object]');
  });

  it('resolves github.com heads through the REST API, so no git binary is needed', async () => {
    const execute = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(`${SHA_1}\n`, { status: 200 }));

    await expect(
      resolveDefaultBranchHead('https://github.com/acme/widgets.git', 'ghs_secret_token', execute, fetchImpl),
    ).resolves.toBe(SHA_1);

    expect(execute).not.toHaveBeenCalled();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/acme/widgets/commits/HEAD');
    expect(init.headers).toMatchObject({
      Accept: 'application/vnd.github.sha',
      Authorization: 'Bearer ghs_secret_token',
    });
  });

  it('sends no Authorization header for public repositories without a token', async () => {
    const fetchImpl = vi.fn(async () => new Response(SHA_1, { status: 200 }));
    await expect(
      resolveDefaultBranchHead('https://github.com/acme/widgets/', undefined, vi.fn(), fetchImpl),
    ).resolves.toBe(SHA_1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/acme/widgets/commits/HEAD');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('surfaces a non-2xx GitHub API response without leaking the token', async () => {
    const fetchImpl = vi.fn(async () => new Response('rate limited', { status: 403, statusText: 'Forbidden' }));
    await expect(
      resolveDefaultBranchHead('https://github.com/acme/widgets', 'ghs_secret_token', vi.fn(), fetchImpl),
    ).rejects.toThrow('GitHub head lookup failed: 403 Forbidden');
  });

  it('keeps the repository token out of git process arguments while resolving a non-GitHub head', async () => {
    const execute = vi.fn(
      async (
        _file: string,
        _args: string[],
        _options: { timeout: number; maxBuffer: number; env: Record<string, string | undefined> },
      ) => ({ stdout: `${SHA_1}\tHEAD\n` }),
    );
    const fetchImpl = vi.fn();

    await expect(
      resolveDefaultBranchHead('https://gitlab.com/acme/widgets', 'ghs_secret_token', execute, fetchImpl),
    ).resolves.toBe(SHA_1);
    expect(fetchImpl).not.toHaveBeenCalled();

    const [file, args, options] = execute.mock.calls[0]!;
    expect(file).toBe('git');
    expect(args).toEqual(['ls-remote', '--', 'https://gitlab.com/acme/widgets', 'HEAD']);
    expect(JSON.stringify(args)).not.toContain('ghs_secret_token');
    expect(options.env).toMatchObject({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.extraheader',
      GIT_TERMINAL_PROMPT: '0',
    });
    expect(options.env.GIT_CONFIG_VALUE_0).not.toContain('ghs_secret_token');
  });

  it('surfaces the git failure when the default-branch head cannot be resolved', async () => {
    const execute = vi.fn(async () => {
      throw Object.assign(new Error('Command failed'), { stderr: 'fatal: unable to access: 429 Too Many Requests\n' });
    });

    await expect(resolveDefaultBranchHead('https://gitlab.com/acme/widgets', undefined, execute)).rejects.toThrow(
      'git ls-remote failed: fatal: unable to access: 429 Too Many Requests',
    );
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
    expect(definition.operations).toEqual([
      { method: 'runCmd', args: [expect.stringContaining('$MASTRA_REPOSITORY_ACCESS_TOKEN')] },
      { method: 'runCmd', args: [expect.stringContaining('$MASTRA_REPOSITORY_ACCESS_TOKEN')] },
      { method: 'runCmd', args: [`git -C "widgets" checkout ${SHA_1}`] },
      markerStep(),
    ]);
    expect(JSON.stringify(definition)).not.toContain('ghs_secret_token');
  });

  it('sends buildEnv as transient build envs outside the serialized definition', async () => {
    const resolveTemplate = createRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/widgets.git' }),
      resolveHead: headOf(SHA_1),
      buildEnv: { TURBO_TOKEN: 'turbo_secret', TURBO_TEAM: 'acme' },
    })!;

    const template = await resolveTemplate();
    const definition = serializeSandboxTemplate(template!);

    expect(getSandboxTemplateBuildEnvs(template!)).toEqual({
      TURBO_TOKEN: 'turbo_secret',
      TURBO_TEAM: 'acme',
    });
    expect(JSON.stringify(definition)).not.toContain('turbo_secret');
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
