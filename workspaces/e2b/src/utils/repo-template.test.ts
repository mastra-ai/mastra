import { Template } from 'e2b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRepoTemplate, refreshRepoTemplate, repoTemplateAlias } from './repo-template';
import type { RepoTemplateOptions } from './repo-template';
import type { NamedTemplateSpec } from './template';

// The head sha is always resolved live, through `git ls-remote`. Driving it
// by mocking git exercises the real resolution path instead of stepping
// around it.
const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

const CLONE_URL = 'https://github.com/octocat/hello.git';
const SHA = 'a'.repeat(40);
const SETUP = 'pnpm install';

/** Make `git ls-remote` report `sha`, or fail when it is undefined. */
function mockHead(sha: string | undefined): void {
  execFileMock.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: unknown) => {
    const done = cb as (err: Error | null, out?: { stdout: string; stderr: string }) => void;
    if (sha === undefined) done(new Error('ls-remote failed'));
    else done(null, { stdout: `${sha}\tHEAD\n`, stderr: '' });
  });
}

/** Identity inputs, as `repoTemplateAlias` takes them. */
const IDENTITY = { cloneUrl: CLONE_URL, sha: SHA, setupCommand: SETUP };
/** Option inputs, as `createRepoTemplate` takes them. */
const BASE: RepoTemplateOptions = {
  getRepositoryAccess: async () => ({ cloneUrl: CLONE_URL }),
  setupCommand: SETUP,
};

beforeEach(() => {
  mockHead(SHA);
});

async function serializedSteps(spec: NamedTemplateSpec): Promise<string> {
  // JSON rendering covers the full serialized spec — every build step
  // string, env, and image reference that would reach the E2B build API.
  // (toDockerfile is unavailable for fromTemplate-based builders.)
  return await Template.toJSON(spec.template as never, false);
}

/** Resolve the deferred spec every repo template now returns. */
async function resolve(options: RepoTemplateOptions): Promise<NamedTemplateSpec> {
  const spec = createRepoTemplate(options);
  if (!spec) throw new Error('expected a spec');
  return await spec.resolveSpec();
}

describe('repoTemplateAlias', () => {
  it('is deterministic for identical inputs', () => {
    expect(repoTemplateAlias(IDENTITY)).toBe(repoTemplateAlias({ ...IDENTITY }));
    expect(repoTemplateAlias(IDENTITY)).toMatch(/^mastra-repo-octocat-hello-[0-9a-f]{8}:sha-[0-9a-f]{12}$/);
  });

  it('keys the sha as a tag on a sha-independent template name', () => {
    const a = repoTemplateAlias(IDENTITY);
    const b = repoTemplateAlias({ ...IDENTITY, sha: 'b'.repeat(40) });
    expect(a).not.toBe(b);
    // Same template NAME — a moved head is a rebuild-in-place under a new
    // tag, not a new template.
    expect(a.split(':')[0]).toBe(b.split(':')[0]);
    expect(a.split(':')[1]).toBe(`sha-${'a'.repeat(12)}`);
  });

  it('changes when the setup command changes', () => {
    expect(repoTemplateAlias(IDENTITY)).not.toBe(repoTemplateAlias({ ...IDENTITY, setupCommand: 'npm ci' }));
  });

  it('changes when the repo changes', () => {
    expect(repoTemplateAlias(IDENTITY)).not.toBe(
      repoTemplateAlias({ ...IDENTITY, cloneUrl: 'https://github.com/octocat/world.git' }),
    );
  });

  it('changes when the host changes, so same-slug repos on two providers stay distinct', () => {
    expect(repoTemplateAlias(IDENTITY)).not.toBe(
      repoTemplateAlias({ ...IDENTITY, cloneUrl: 'https://gitlab.com/octocat/hello.git' }),
    );
  });

  it('treats clone-URL spellings of one repo as one template', () => {
    for (const spelling of [
      'https://github.com/octocat/hello',
      'https://github.com/octocat/hello.git/',
      'https://GitHub.com/octocat/hello.git',
    ]) {
      expect(repoTemplateAlias({ ...IDENTITY, cloneUrl: spelling })).toBe(repoTemplateAlias(IDENTITY));
    }
  });

  it('changes when build env changes, since it changes what setup installs', () => {
    const withEnv = repoTemplateAlias({ ...IDENTITY, buildEnv: { NPM_TOKEN: 'one' } });
    expect(withEnv).not.toBe(repoTemplateAlias(IDENTITY));
    expect(withEnv).not.toBe(repoTemplateAlias({ ...IDENTITY, buildEnv: { NPM_TOKEN: 'two' } }));
    // Key order is not identity.
    expect(repoTemplateAlias({ ...IDENTITY, buildEnv: { A: '1', B: '2' } })).toBe(
      repoTemplateAlias({ ...IDENTITY, buildEnv: { B: '2', A: '1' } }),
    );
  });

  it('degrades to the current tag without a sha', () => {
    const shaless = { cloneUrl: CLONE_URL, setupCommand: SETUP };
    // Same template NAME as the tagged form, pinned to the stable `current`
    // tag — never a bare name, whose create would resolve the unassigned
    // `default` tag and 404.
    const name = repoTemplateAlias(IDENTITY).split(':')[0];
    expect(repoTemplateAlias(shaless)).toBe(`${name}:current`);
  });
});

describe('createRepoTemplate', () => {
  it('returns undefined when the session has no repository access', () => {
    expect(createRepoTemplate({ getRepositoryAccess: undefined })).toBeUndefined();
    expect(createRepoTemplate({ getRepositoryAccess: undefined, setupCommand: SETUP })).toBeUndefined();
  });

  it('resolves to a spec whose alias matches repoTemplateAlias', async () => {
    expect((await resolve(BASE)).alias).toBe(repoTemplateAlias(IDENTITY));
  });

  it('clones into $HOME, pins the sha, and runs the setup command in the workdir', async () => {
    const steps = await serializedSteps(await resolve(BASE));
    // Serialized as JSON, so the shell double quotes appear escaped.
    expect(steps).toContain('git clone https://github.com/octocat/hello \\"$HOME/hello\\"');
    expect(steps).toContain(`checkout ${SHA}`);
    expect(steps).toContain('cd \\"$HOME/hello\\" && pnpm install');
  });

  it('pins whatever head the repository reports, so a moved branch retags', async () => {
    const head = 'c'.repeat(40);
    mockHead(head);
    const resolved = await resolve(BASE);
    expect(resolved.alias).toBe(repoTemplateAlias({ cloneUrl: CLONE_URL, setupCommand: SETUP, sha: head }));
    expect(await serializedSteps(resolved)).toContain(`checkout ${head}`);
  });

  it('looks the head up against the clone URL without cloning', async () => {
    await resolve(BASE);
    const [command, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(command).toBe('git');
    expect(args).toContain('ls-remote');
    expect(args).toContain(CLONE_URL);
  });

  it('degrades to the sha-less alias when head resolution fails', async () => {
    for (const head of [undefined, 'not a sha']) {
      mockHead(head);
      const resolved = await resolve(BASE);
      expect(resolved.alias).toBe(repoTemplateAlias({ cloneUrl: CLONE_URL, setupCommand: SETUP }));
      const steps = await serializedSteps(resolved);
      expect(steps).toContain('git clone https://github.com/octocat/hello');
      expect(steps).not.toContain('checkout');
    }
  });

  it('never puts anything credential-shaped in the serialized template', async () => {
    const steps = await serializedSteps(await resolve(BASE));
    // Without a credential the serialized spec must contain no credential
    // mechanism: no auth headers, no credential config, no userinfo in the
    // clone URL, no env interpolation of secrets.
    for (const marker of [
      'x-access-token',
      'extraHeader',
      'Authorization',
      'credential',
      'GIT_TOKEN',
      'GH_TOKEN',
      'GITHUB_TOKEN',
      '@github.com',
    ]) {
      expect(steps).not.toContain(marker);
    }
  });

  describe('build auth', () => {
    const TOKEN = 'ghs_livetoken1234567890';
    const authed: RepoTemplateOptions = {
      getRepositoryAccess: async () => ({
        cloneUrl: CLONE_URL,
        authorization: { scheme: 'bearer', token: TOKEN },
      }),
      setupCommand: SETUP,
    };

    it('sets the credential only via envs and references it from commands', async () => {
      const serialized = await serializedSteps(await resolve(authed));
      // The token VALUE appears only in the env map, and every command
      // references it through the env var. No expanded header, no tokened
      // URL, nothing a filesystem layer could capture.
      expect(serialized).toContain('"type": "ENV"');
      expect(serialized).toContain('$GH_TOKEN');
      expect(serialized).toContain('http.extraheader');
      expect(serialized).not.toContain('@github.com');
      expect(serialized).toContain('clone https://github.com/octocat/hello');
    });

    it('names the credential GH_TOKEN, the same variable a session installs before setup', async () => {
      const serialized = await serializedSteps(await resolve(authed));
      // A setup command that shells out to `gh` or authenticated https works
      // in a session because the session installs GH_TOKEN before setup; the
      // build has to match or the same command fails only during the build.
      const definition = JSON.parse(serialized) as { steps: { type: string; args: string[] }[] };
      const envStep = definition.steps.find(step => step.type === 'ENV');
      expect(envStep?.args).toContain('GH_TOKEN');
      expect(envStep?.args).toContain(TOKEN);
    });

    it('clones tokenlessly when access returns a URL but no credential', async () => {
      const serialized = await serializedSteps(
        await resolve({ ...authed, getRepositoryAccess: async () => ({ cloneUrl: CLONE_URL }) }),
      );
      expect(serialized).not.toContain('GH_TOKEN');
      expect(serialized).not.toContain('extraheader');
    });

    it('fails resolution when the accessor rejects, since the clone URL comes from it too', async () => {
      const spec = createRepoTemplate({
        ...authed,
        getRepositoryAccess: async () => {
          throw new Error('mint failed');
        },
      });
      // A rejection leaves no clone URL, so resolution throws and the
      // sandbox degrades to its default template plus a runtime clone.
      await expect(spec?.resolveSpec()).rejects.toThrow(/clone URL/);
    });
  });

  it('merges buildEnv into the build environment', async () => {
    const serialized = await serializedSteps(await resolve({ ...BASE, buildEnv: { NPM_TOKEN: 'npm_abc' } }));
    expect(serialized).toContain('NPM_TOKEN');
    expect(serialized).toContain('npm_abc');
  });

  it('accepts a lazy buildEnv resolver', async () => {
    const serialized = await serializedSteps(
      await resolve({ ...BASE, buildEnv: async () => ({ PIP_INDEX_URL: 'https://index.example' }) }),
    );
    expect(serialized).toContain('PIP_INDEX_URL');
  });

  it('needs no root prep — the clone lands in the build user home', async () => {
    const steps = await serializedSteps(await resolve(BASE));
    expect(steps).not.toContain('chown');
    expect(steps).not.toContain('mkdir -p /workspace');
  });

  it('carries no named fallback — a broken build degrades to the default mountable template', async () => {
    expect((await resolve(BASE)).fallbackTemplate).toBeUndefined();
  });

  it('carries a current-tag staleRef and build tag for stale-first resolution', async () => {
    const spec = await resolve(BASE);
    const name = spec.alias.split(':')[0];
    expect(spec.staleRef).toBe(`${name}:current`);
    expect(spec.buildTags).toEqual(['current']);
  });

  it('derives the workdir from the repository, so a hostile name cannot escape it', async () => {
    const steps = await serializedSteps(
      await resolve({ ...BASE, getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/..evil.git' }) }),
    );
    // The repository name keeps its real spelling in the clone URL; only
    // the derived checkout path is sanitized.
    expect(steps).toContain('\\"$HOME/evil\\"');
    expect(steps).not.toContain('$HOME/..');
  });

  it('rejects clone URLs that could reach the build shell as anything but a URL', async () => {
    for (const cloneUrl of [
      'git@github.com:octocat/hello.git',
      'https://github.com/octocat/hello.git; rm -rf /',
      'https://github.com/octocat/$(whoami)',
      'https://github.com',
      'file:///etc/passwd',
    ]) {
      const spec = createRepoTemplate({ ...BASE, getRepositoryAccess: async () => ({ cloneUrl }) });
      await expect(spec?.resolveSpec()).rejects.toThrow(/cloneUrl/);
    }
  });
});

describe('refreshRepoTemplate', () => {
  const head = 'f'.repeat(40);
  const options: RepoTemplateOptions = {
    getRepositoryAccess: async () => ({ cloneUrl: CLONE_URL }),
    setupCommand: SETUP,
  };

  beforeEach(() => {
    mockHead(head);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reuses an existing build at the current head without building', async () => {
    const exists = vi.spyOn(Template, 'exists').mockResolvedValue(true);
    const build = vi.spyOn(Template, 'build').mockRejectedValue(new Error('must not build'));
    const result = await refreshRepoTemplate(options);
    expect(result).toEqual({
      ref: repoTemplateAlias({ cloneUrl: CLONE_URL, setupCommand: SETUP, sha: head }),
      action: 'reused',
      sha: head,
    });
    expect(exists).toHaveBeenCalledWith(result.ref, undefined);
    expect(build).not.toHaveBeenCalled();
  });

  it('builds the missing head ref and moves the current tag', async () => {
    vi.spyOn(Template, 'exists').mockResolvedValue(false);
    const build = vi
      .spyOn(Template, 'build')
      .mockResolvedValue({ alias: 'x', name: 'x', tags: [], templateId: 't', buildId: 'b' });
    const result = await refreshRepoTemplate(options);
    expect(result.action).toBe('built');
    expect(result.ref).toBe(repoTemplateAlias({ cloneUrl: CLONE_URL, setupCommand: SETUP, sha: head }));
    expect(build).toHaveBeenCalledTimes(1);
    expect(build.mock.calls[0]?.[1]).toBe(result.ref);
    expect(build.mock.calls[0]?.[2]).toMatchObject({ tags: ['current'] });
  });

  it('rejects on build failure so external warmers can observe it', async () => {
    vi.spyOn(Template, 'exists').mockResolvedValue(false);
    vi.spyOn(Template, 'build').mockRejectedValue(new Error('registry flake'));
    await expect(refreshRepoTemplate(options)).rejects.toThrow('registry flake');
  });

  it('degrades to the current-tag ref when the head cannot be resolved', async () => {
    vi.spyOn(Template, 'exists').mockResolvedValue(true);
    mockHead(undefined);
    const result = await refreshRepoTemplate(options);
    expect(result).toEqual({
      ref: repoTemplateAlias({ cloneUrl: CLONE_URL, setupCommand: SETUP }),
      action: 'reused',
    });
  });
});
