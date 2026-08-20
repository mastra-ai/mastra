import { Template } from 'e2b';
import { describe, expect, it } from 'vitest';

import { createRepoTemplate, repoTemplateAlias } from './repo-template';
import { isNamedTemplateSpec } from './template';

const BASE = { repoFullName: 'octocat/hello', sha: 'a'.repeat(40), setupCommand: 'pnpm install' };

async function serializedSteps(spec: ReturnType<typeof createRepoTemplate>): Promise<string> {
  // JSON rendering covers the full serialized spec — every build step
  // string, env, and image reference that would reach the E2B build API.
  // (toDockerfile is unavailable for fromTemplate-based builders.)
  return await Template.toJSON(spec.template as never, false);
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
  it('returns a named spec whose alias matches repoTemplateAlias', () => {
    const spec = createRepoTemplate(BASE);
    expect(isNamedTemplateSpec(spec)).toBe(true);
    expect(spec.alias).toBe(repoTemplateAlias(BASE));
  });

  it('clones, pins the sha, and runs the setup command in the workdir', async () => {
    const steps = await serializedSteps(createRepoTemplate(BASE));
    expect(steps).toContain('git clone https://github.com/octocat/hello.git /workspace/octocat/hello');
    expect(steps).toContain(`checkout ${BASE.sha}`);
    expect(steps).toContain('cd /workspace/octocat/hello && pnpm install');
  });

  it('omits pinning for the sha-less variant', async () => {
    const steps = await serializedSteps(
      createRepoTemplate({ repoFullName: BASE.repoFullName, setupCommand: BASE.setupCommand }),
    );
    expect(steps).toContain('git clone https://github.com/octocat/hello.git');
    expect(steps).not.toContain('checkout');
  });

  it('never puts anything credential-shaped in the serialized template', async () => {
    const steps = await serializedSteps(createRepoTemplate(BASE));
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
    const steps = await serializedSteps(createRepoTemplate(BASE));
    expect(steps).toContain('mkdir -p /workspace/octocat/hello && chown -R user:user /workspace');
  });

  it('carries a named workspace-base fallback so a broken build still yields a writable workdir', () => {
    const spec = createRepoTemplate(BASE);
    expect(isNamedTemplateSpec(spec.fallbackTemplate as never)).toBe(true);
    expect((spec.fallbackTemplate as { alias: string }).alias).toMatch(/^mastra-workspace-base-[0-9a-f]{16}$/);
  });

  it('rejects malformed inputs', () => {
    expect(() => createRepoTemplate({ repoFullName: 'no-slash' })).toThrow(/repoFullName/);
    expect(() => createRepoTemplate({ repoFullName: 'a/b; rm -rf /' })).toThrow(/repoFullName/);
    expect(() => createRepoTemplate({ ...BASE, sha: 'not-hex!' })).toThrow(/sha/);
    expect(() => createRepoTemplate({ ...BASE, workdir: 'relative/path' })).toThrow(/workdir/);
    expect(() => createRepoTemplate({ ...BASE, workdir: '/tmp/../etc' })).toThrow(/workdir/);
  });
});
