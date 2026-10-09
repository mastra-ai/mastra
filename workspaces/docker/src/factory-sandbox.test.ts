import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describeFactorySandbox, isFactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DockerFactorySandbox } from './factory-sandbox';
import { DockerSandbox } from './sandbox';
import { createDockerRepoTemplate } from './template/repo-template';

const cloneUrl = 'https://example.com/acme/app.git';
const sha = '0123456789abcdef0123456789abcdef01234567';

function context(): FactorySandboxContext {
  return {
    sessionId: 'sess_1',
    sandboxId: 'sbx_prev',
    repoFullName: 'acme/app',
    getRepositoryAccess: async () => ({ cloneUrl }),
    setupCommand: 'pnpm install',
    resolveHead: async () => sha,
  };
}

describe('DockerFactorySandbox', () => {
  // Clone URLs must be https, so `git ls-remote` is stubbed on PATH.
  let dir: string;
  let prevPath: string | undefined;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'docker-factory-sandbox-'));
    writeFileSync(join(dir, 'git'), `#!/bin/sh\nprintf '${sha}\\tHEAD\\n'\n`, { mode: 0o755 });
    prevPath = process.env.PATH;
    process.env.PATH = `${dir}:${prevPath}`;
  });
  afterAll(() => {
    process.env.PATH = prevPath;
    rmSync(dir, { recursive: true, force: true });
  });

  it('is a branded FactorySandbox with template-affecting image and owner settings and no builds', () => {
    const sandbox = new DockerFactorySandbox();
    expect(isFactorySandbox(sandbox)).toBe(true);
    const description = describeFactorySandbox(sandbox);
    expect(description.provider).toBe('docker');
    expect(Object.keys(description.settingsSchema.properties ?? {})).toEqual(['baseImage', 'owner']);
    expect(description.capabilities).toEqual({ template: true, builds: { available: false, history: false } });
    expect(sandbox.builds).toBeUndefined();
  });

  it('builds the same Dockerfile as createDockerRepoTemplate(ctx) for an unset environment', async () => {
    const ctx = context();
    const direct = await createDockerRepoTemplate({
      getRepositoryAccess: ctx.getRepositoryAccess,
      setupCommand: ctx.setupCommand,
    })!();
    const viaClass = await new DockerFactorySandbox().template(ctx, {})!();
    expect(viaClass.dockerfile).toBe(direct.dockerfile);
    expect(viaClass.templateId).toBe(direct.templateId);
  });

  it('applies settings over provider defaults and keeps the host build env', async () => {
    const ctx = context();
    const sandbox = new DockerFactorySandbox({
      template: { buildEnv: { TURBO_TOKEN: 't' } },
      defaults: { baseImage: 'node:20-slim', owner: 'node' },
    });
    const defaulted = await sandbox.template(ctx, {})!();
    expect(defaulted.dockerfile).toContain('FROM node:20-slim');
    expect(defaulted.dockerfile).toContain('--chown=node');
    const tuned = await sandbox.template(ctx, { baseImage: 'node:22' })!();
    expect(tuned.dockerfile).toContain('FROM node:22');
    expect(tuned.dockerfile).toContain('--chown=node');
    expect(tuned.templateId).not.toBe(defaulted.templateId);
    const direct = await createDockerRepoTemplate({
      getRepositoryAccess: ctx.getRepositoryAccess,
      setupCommand: ctx.setupCommand,
      buildEnv: { TURBO_TOKEN: 't' },
      baseImage: 'node:22',
      owner: 'node',
    })!();
    expect(tuned.dockerfile).toBe(direct.dockerfile);
  });

  it('returns no template for a session without repositories', () => {
    expect(new DockerFactorySandbox().template({ sessionId: 's' }, {})).toBeUndefined();
  });

  it('creates a DockerSandbox keyed by the session with the template and runtime options', () => {
    const created = new DockerFactorySandbox({ env: { CI: '1' }, memory: 512 }).create(
      { ...context(), workingDirectory: '/srv/repos' },
      {},
    );
    expect(created.workingDirectory).toBe('/srv/repos');
    expect(created).toBeInstanceOf(DockerSandbox);
    expect(created.id).toBe('sess_1');
    expect((created as any)._templateSpec).toBeTypeOf('function');
    expect((created as any)._env).toEqual({ CI: '1' });
  });
});
