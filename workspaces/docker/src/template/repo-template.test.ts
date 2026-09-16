/**
 * createDockerRepoTemplate tests — the Dockerfile assembly is asserted through
 * the pure `buildRepoTemplate`; head resolution is exercised against a local
 * bare git repository served over the file protocol (no network, no daemon).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SETUP_MARKER_PATH } from '@internal/workspace';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRepoTemplate, createDockerRepoTemplate, resolveHead } from './repo-template';

const cloneUrl = 'https://example.com/acme/app.git';

describe('buildRepoTemplate', () => {
  it('clones the default branch under /workspace/<repo> and sets the workdir', () => {
    const dockerfile = buildRepoTemplate({ cloneUrl, workingDirectory: '/workspace' }).dockerfile;
    // The slim default base has no git, so it is installed before the clone stage.
    expect(dockerfile.indexOf('apt-get install')).toBeLessThan(dockerfile.indexOf('git clone'));
    expect(dockerfile).toMatch(/apt-get install[^\n]*\bgit\b/);
    expect(dockerfile).toContain(
      "git clone --depth=1 --single-branch 'https://example.com/acme/app.git' '/workspace/app'",
    );
    expect(dockerfile).toContain('WORKDIR /workspace/app');
  });

  it('clones a branch ref when no sha could be resolved', () => {
    const dockerfile = buildRepoTemplate({ cloneUrl, ref: 'dev', workingDirectory: '/workspace' }).dockerfile;
    expect(dockerfile).toContain("--branch 'dev'");
  });

  it('pins a resolved sha with a full clone + detached checkout, making it part of the identity', () => {
    const a = buildRepoTemplate({ cloneUrl, sha: 'a1b2c3d4', workingDirectory: '/workspace' });
    const b = buildRepoTemplate({ cloneUrl, sha: 'ffffffff', workingDirectory: '/workspace' });
    expect(a.dockerfile).toContain("git clone 'https://example.com/acme/app.git' '/workspace/app'");
    expect(a.dockerfile).not.toContain('--depth=1');
    expect(a.dockerfile).toContain("git -C '/workspace/app' checkout --detach 'a1b2c3d4'");
    expect(a.templateId).not.toBe(b.templateId);
  });

  it('passes the token by value to the clone stage only and keeps it out of the identity', () => {
    const withToken = buildRepoTemplate({ cloneUrl, token: 'tok-1', workingDirectory: '/workspace' });
    const rotated = buildRepoTemplate({ cloneUrl, token: 'tok-2', workingDirectory: '/workspace' });
    const dockerfile = withToken.dockerfile;
    expect(dockerfile).toContain('AS mastra-secret-');
    expect(dockerfile).toContain('ARG GH_TOKEN');
    expect(dockerfile).toContain('http.extraheader');
    expect(dockerfile).not.toContain('tok-1');
    expect(dockerfile).not.toMatch(/ENV .*GH_TOKEN/);
    const mainStages = dockerfile.split('\nFROM ').filter(stage => !stage.includes('AS mastra-secret-'));
    expect(mainStages.join('\n')).not.toContain('ARG GH_TOKEN');
    expect(withToken.templateId).toBe(rotated.templateId);
  });

  it('bakes buildEnv into ENV and the identity', () => {
    const a = buildRepoTemplate({ cloneUrl, buildEnv: { NPM_CONFIG_REGISTRY: 'https://r1' }, workingDirectory: '/w' });
    const b = buildRepoTemplate({ cloneUrl, buildEnv: { NPM_CONFIG_REGISTRY: 'https://r2' }, workingDirectory: '/w' });
    expect(a.dockerfile).toContain('ENV NPM_CONFIG_REGISTRY=');
    expect(a.templateId).not.toBe(b.templateId);
  });

  it('runs setup commands and writes the completion marker last', () => {
    const dockerfile = buildRepoTemplate({
      cloneUrl,
      setupCommand: ['npm ci', 'npm run build'],
      workingDirectory: '/workspace',
    }).dockerfile;
    expect(dockerfile).toContain('RUN npm ci');
    expect(dockerfile).toContain('RUN npm run build');
    expect(dockerfile.indexOf(SETUP_MARKER_PATH)).toBeGreaterThan(dockerfile.indexOf('npm run build'));
  });

  it('supports a custom base image and working directory', () => {
    const dockerfile = buildRepoTemplate({ cloneUrl, baseImage: 'ubuntu:24.04', workingDirectory: '/srv/' }).dockerfile;
    expect(dockerfile).toContain('FROM ubuntu:24.04');
    expect(dockerfile).toContain('WORKDIR /srv/app');
  });
});

describe('createDockerRepoTemplate', () => {
  it('returns undefined when there is no repository access', () => {
    expect(createDockerRepoTemplate({ getRepositoryAccess: undefined })).toBeUndefined();
  });

  it('rejects unsafe refs and relative working directories up front', () => {
    const getRepositoryAccess = async () => ({ cloneUrl });
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, ref: 'x; rm -rf /' })).toThrow(/Invalid ref/);
    expect(() => createDockerRepoTemplate({ getRepositoryAccess, workingDirectory: 'rel' })).toThrow(/absolute/);
  });

  it('rejects clone URLs that could smuggle shell or credentials', async () => {
    const resolver = createDockerRepoTemplate({
      getRepositoryAccess: async () => ({ cloneUrl: 'https://user:pw@example.com/a/b.git' }),
    })!;
    await expect(resolver()).rejects.toThrow(/Invalid cloneUrl/);
  });

  it('propagates getRepositoryAccess failures instead of masking them', async () => {
    const resolver = createDockerRepoTemplate({
      getRepositoryAccess: async () => {
        throw new Error('token exchange failed');
      },
    })!;
    await expect(resolver()).rejects.toThrow(/token exchange failed/);
  });

  it('throws when access resolves to no clone URL', async () => {
    const resolver = createDockerRepoTemplate({ getRepositoryAccess: async () => undefined })!;
    await expect(resolver()).rejects.toThrow(/no clone URL/);
  });

  describe('head resolution', () => {
    let dir: string;
    let bare: string;
    let headSha: string;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'docker-repo-template-'));
      const work = join(dir, 'work');
      bare = join(dir, 'app.git');
      const git = (args: string[], cwd = work) =>
        execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
          .toString()
          .trim();
      execFileSync('git', ['init', '-q', '-b', 'main', work]);
      git(['config', 'user.email', 't@example.com']);
      git(['config', 'user.name', 't']);
      writeFileSync(join(work, 'README'), 'hi');
      git(['add', '.']);
      git(['commit', '-q', '-m', 'init']);
      headSha = git(['rev-parse', 'HEAD']);
      execFileSync('git', ['clone', '-q', '--bare', work, bare]);
    });

    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('resolves the default branch, a named branch, and a tag to shas via ls-remote', async () => {
      execFileSync('git', ['tag', 'v1', headSha], { cwd: bare });
      await expect(resolveHead(bare, undefined, undefined)).resolves.toBe(headSha);
      await expect(resolveHead(bare, 'main', undefined)).resolves.toBe(headSha);
      await expect(resolveHead(bare, 'v1', undefined)).resolves.toBe(headSha);
      await expect(resolveHead(bare, 'nope', undefined)).resolves.toBeUndefined();
      await expect(resolveHead(join(dir, 'missing.git'), undefined, undefined)).resolves.toBeUndefined();
    });

    it('passes the token to ls-remote through GIT_CONFIG_* env, never argv', async () => {
      const binDir = join(dir, 'bin');
      mkdirSync(binDir, { recursive: true });
      const log = join(dir, 'git.log');
      writeFileSync(
        join(binDir, 'git'),
        `#!/bin/sh\nprintf 'ARGV=%s\\n' "$*" >> '${log}'\nprintf 'CFG=%s\\n' "$GIT_CONFIG_VALUE_0" >> '${log}'\nprintf '${headSha}\\tHEAD\\n'\n`,
        { mode: 0o755 },
      );
      const prevPath = process.env.PATH;
      process.env.PATH = `${binDir}:${prevPath}`;
      try {
        await expect(resolveHead('https://example.com/a/b.git', undefined, 'tok-secret')).resolves.toBe(headSha);
      } finally {
        process.env.PATH = prevPath;
      }
      const recorded = readFileSync(log, 'utf8');
      const expectedHeader = `AUTHORIZATION: basic ${Buffer.from('x-access-token:tok-secret').toString('base64')}`;
      expect(recorded).toContain(`CFG=${expectedHeader}`);
      expect(recorded).toMatch(/ARGV=ls-remote -- https:\/\/example\.com\/a\/b\.git HEAD/);
      expect(recorded).not.toContain('ARGV=-c');
      expect(recorded).not.toContain('tok-secret');
    });

    it('pins the current head sha into the template so a moved branch rebuilds', async () => {
      const getRepositoryAccess = async () => ({ cloneUrl });
      const resolver = createDockerRepoTemplate({ getRepositoryAccess })!;
      // Network is unavailable to example.com; resolution must degrade, not throw.
      const unpinned = await resolver();
      expect(unpinned.dockerfile).toContain('--depth=1');
      expect(unpinned.dockerfile).not.toContain('checkout --detach');

      // A sha ref skips the network entirely and is pinned verbatim.
      const pinned = await createDockerRepoTemplate({ getRepositoryAccess, ref: headSha })!();
      expect(pinned.dockerfile).toContain(`checkout --detach '${headSha}'`);
      expect(pinned.templateId).not.toBe(unpinned.templateId);
    });
  });
});
