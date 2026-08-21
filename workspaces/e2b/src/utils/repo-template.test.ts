import { Template } from 'e2b';
import { describe, expect, it } from 'vitest';

import { createRepoTemplate, repoTemplateAlias } from './repo-template';
import { isDeferredNamedTemplateSpec, isNamedTemplateSpec } from './template';
import type { NamedTemplateSpec } from './template';

const BASE = { repoFullName: 'octocat/hello', sha: 'a'.repeat(40), setupCommand: 'pnpm install' };

async function serializedSteps(spec: NamedTemplateSpec): Promise<string> {
  // JSON rendering covers the full serialized spec — every build step
  // string, env, and image reference that would reach the E2B build API.
  // (toDockerfile is unavailable for fromTemplate-based builders.)
  return await Template.toJSON(spec.template as never, false);
}

function namedSpec(spec: ReturnType<typeof createRepoTemplate>): NamedTemplateSpec {
  if (!isNamedTemplateSpec(spec as never)) throw new Error('expected a named spec');
  return spec as NamedTemplateSpec;
}

describe('repoTemplateAlias', () => {
  it('is deterministic for identical inputs', () => {
    expect(repoTemplateAlias(BASE)).toBe(repoTemplateAlias({ ...BASE }));
    expect(repoTemplateAlias(BASE)).toMatch(/^mastra-repo-octocat-hello-[0-9a-f]{8}:sha-[0-9a-f]{12}$/);
  });

  it('keys the sha as a tag on a sha-independent template name', () => {
    const a = repoTemplateAlias(BASE);
    const b = repoTemplateAlias({ ...BASE, sha: 'b'.repeat(40) });
    expect(a).not.toBe(b);
    // Same template NAME — a moved head is a rebuild-in-place under a new
    // tag, not a new template.
    expect(a.split(':')[0]).toBe(b.split(':')[0]);
    expect(a.split(':')[1]).toBe(`sha-${'a'.repeat(12)}`);
  });

  it('changes when the setup command changes', () => {
    expect(repoTemplateAlias(BASE)).not.toBe(repoTemplateAlias({ ...BASE, setupCommand: 'npm ci' }));
  });

  it('changes when the repo changes', () => {
    expect(repoTemplateAlias(BASE)).not.toBe(repoTemplateAlias({ ...BASE, repoFullName: 'octocat/world' }));
  });

  it('degrades to the untagged template name without a sha', () => {
    const shaless = { repoFullName: BASE.repoFullName, setupCommand: BASE.setupCommand };
    expect(repoTemplateAlias(shaless)).toBe(repoTemplateAlias({ ...shaless }));
    // The untagged form IS the tagged form's template name.
    expect(repoTemplateAlias(BASE)).toBe(`${repoTemplateAlias(shaless)}:sha-${'a'.repeat(12)}`);
  });
});

describe('createRepoTemplate', () => {
  it('returns a named spec whose alias matches repoTemplateAlias when a sha is given', () => {
    const spec = createRepoTemplate(BASE);
    expect(isNamedTemplateSpec(spec as never)).toBe(true);
    expect(namedSpec(spec).alias).toBe(repoTemplateAlias(BASE));
  });

  it('clones, pins the sha, and runs the setup command in the workdir', async () => {
    const steps = await serializedSteps(namedSpec(createRepoTemplate(BASE)));
    expect(steps).toContain('git clone https://github.com/octocat/hello.git /workspace/octocat/hello');
    expect(steps).toContain(`checkout ${BASE.sha}`);
    expect(steps).toContain('cd /workspace/octocat/hello && pnpm install');
  });

  it('returns a deferred spec without a sha and pins it to the resolved head', async () => {
    const head = 'c'.repeat(40);
    const options = { repoFullName: BASE.repoFullName, setupCommand: BASE.setupCommand };
    const spec = createRepoTemplate({ ...options, resolveHead: async () => head });
    expect(isDeferredNamedTemplateSpec(spec as never)).toBe(true);
    if (isNamedTemplateSpec(spec as never)) throw new Error('expected deferred');

    const resolved = await (spec as { resolveSpec(): Promise<NamedTemplateSpec> }).resolveSpec();
    expect(resolved.alias).toBe(repoTemplateAlias({ ...options, sha: head }));
    const steps = await serializedSteps(resolved);
    expect(steps).toContain(`checkout ${head}`);
  });

  it('degrades the deferred spec to the sha-less alias when head resolution fails', async () => {
    const options = { repoFullName: BASE.repoFullName, setupCommand: BASE.setupCommand };
    for (const resolveHead of [
      async () => undefined,
      async () => 'not a sha',
      async (): Promise<string | undefined> => {
        throw new Error('offline');
      },
    ]) {
      const spec = createRepoTemplate({ ...options, resolveHead });
      const resolved = await (spec as { resolveSpec(): Promise<NamedTemplateSpec> }).resolveSpec();
      expect(resolved.alias).toBe(repoTemplateAlias(options));
      const steps = await serializedSteps(resolved);
      expect(steps).toContain('git clone https://github.com/octocat/hello.git');
      expect(steps).not.toContain('checkout');
    }
  });

  it('never puts anything credential-shaped in the serialized template', async () => {
    const steps = await serializedSteps(namedSpec(createRepoTemplate(BASE)));
    // The API takes no token at all, and the serialized spec must contain no
    // credential mechanism: no auth headers, no credential config, no
    // userinfo in the clone URL, no env interpolation of secrets.
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
    const authed = {
      repoFullName: BASE.repoFullName,
      setupCommand: BASE.setupCommand,
      getAuthToken: async () => TOKEN,
      resolveHead: async () => 'd'.repeat(40),
    };

    it('is always deferred when an auth resolver is configured', () => {
      expect(isDeferredNamedTemplateSpec(createRepoTemplate(authed) as never)).toBe(true);
      expect(isDeferredNamedTemplateSpec(createRepoTemplate({ ...authed, sha: BASE.sha }) as never)).toBe(true);
    });

    it('passes the token to the head resolver and sets it only via envs', async () => {
      let sawToken: string | undefined;
      const spec = createRepoTemplate({
        ...authed,
        resolveHead: async (_repo, token) => {
          sawToken = token;
          return 'd'.repeat(40);
        },
      });
      const resolved = await (spec as { resolveSpec(): Promise<NamedTemplateSpec> }).resolveSpec();
      expect(sawToken).toBe(TOKEN);
      const serialized = await serializedSteps(resolved);
      // The token VALUE appears exactly once — in the env map — and every
      // command references it only through the env var. No expanded header,
      // no tokened URL, nothing a filesystem layer could capture.
      expect(serialized).toContain('"type": "ENV"');
      expect(serialized.split(TOKEN).length - 1).toBe(1);
      expect(serialized).toContain('$MASTRA_BUILD_GH_TOKEN');
      expect(serialized).toContain('http.extraheader');
      expect(serialized).not.toContain('@github.com');
      expect(serialized).toContain('clone https://github.com/octocat/hello.git');
    });

    it('degrades to tokenless behavior when minting fails', async () => {
      const spec = createRepoTemplate({
        ...authed,
        getAuthToken: async () => {
          throw new Error('mint failed');
        },
        resolveHead: async (_repo, token) => (token ? 'e'.repeat(40) : undefined),
      });
      const resolved = await (spec as { resolveSpec(): Promise<NamedTemplateSpec> }).resolveSpec();
      // No token → head resolver got none → untagged ref, plain clone.
      expect(resolved.alias).toBe(
        repoTemplateAlias({ repoFullName: BASE.repoFullName, setupCommand: BASE.setupCommand }),
      );
      const serialized = await serializedSteps(resolved);
      expect(serialized).not.toContain('MASTRA_BUILD_GH_TOKEN');
      expect(serialized).not.toContain('extraheader');
    });
  });

  it('preps a user-writable /workspace (via the base steps) before cloning as user', async () => {
    const steps = await serializedSteps(namedSpec(createRepoTemplate(BASE)));
    expect(steps).toContain('mkdir -p /workspace && chown -R user:user /workspace');
  });

  it('carries no named fallback — a broken build degrades to the default mountable template', () => {
    const spec = namedSpec(createRepoTemplate(BASE));
    expect(spec.fallbackTemplate).toBeUndefined();
  });

  it('pins the /workspace boundary for custom workdirs', () => {
    expect(() => createRepoTemplate({ ...BASE, workdir: '/' })).toThrow();
    expect(() => createRepoTemplate({ ...BASE, workdir: '/home/repo' })).toThrow();
    expect(() => createRepoTemplate({ ...BASE, workdir: '/tmp/repo' })).toThrow();
    expect(() => createRepoTemplate({ ...BASE, workdir: '/workspace/../home' })).toThrow();
    expect(namedSpec(createRepoTemplate({ ...BASE, workdir: '/workspace/custom/dir' })).alias).toMatch(/^mastra-repo-/);
  });

  it('rejects malformed inputs', () => {
    expect(() => createRepoTemplate({ repoFullName: 'no-slash' })).toThrow(/repoFullName/);
    expect(() => createRepoTemplate({ repoFullName: 'a/b; rm -rf /' })).toThrow(/repoFullName/);
    expect(() => createRepoTemplate({ ...BASE, sha: 'not-hex!' })).toThrow(/sha/);
    expect(() => createRepoTemplate({ ...BASE, workdir: 'relative/path' })).toThrow(/workdir/);
    expect(() => createRepoTemplate({ ...BASE, workdir: '/tmp/../etc' })).toThrow(/workdir/);
  });
});
