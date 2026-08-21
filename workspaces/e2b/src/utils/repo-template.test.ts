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
    expect(repoTemplateAlias(BASE)).toMatch(/^mastra-repo-[0-9a-f]{16}$/);
  });

  it('changes when the sha changes', () => {
    expect(repoTemplateAlias(BASE)).not.toBe(repoTemplateAlias({ ...BASE, sha: 'b'.repeat(40) }));
  });

  it('changes when the setup command changes', () => {
    expect(repoTemplateAlias(BASE)).not.toBe(repoTemplateAlias({ ...BASE, setupCommand: 'npm ci' }));
  });

  it('changes when the repo changes', () => {
    expect(repoTemplateAlias(BASE)).not.toBe(repoTemplateAlias({ ...BASE, repoFullName: 'octocat/world' }));
  });

  it('supports a stable sha-less variant', () => {
    const shaless = { repoFullName: BASE.repoFullName, setupCommand: BASE.setupCommand };
    expect(repoTemplateAlias(shaless)).toBe(repoTemplateAlias({ ...shaless }));
    expect(repoTemplateAlias(shaless)).not.toBe(repoTemplateAlias(BASE));
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

  it('preps the workspace root as root before cloning as user', async () => {
    const steps = await serializedSteps(namedSpec(createRepoTemplate(BASE)));
    expect(steps).toContain('mkdir -p /workspace/octocat/hello && chown -R user:user /workspace');
  });

  it('carries a named workspace-base fallback so a broken build still yields a writable workdir', () => {
    const spec = namedSpec(createRepoTemplate(BASE));
    expect(isNamedTemplateSpec(spec.fallbackTemplate as never)).toBe(true);
    expect((spec.fallbackTemplate as { alias: string }).alias).toMatch(/^mastra-workspace-base-[0-9a-f]{16}$/);
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
