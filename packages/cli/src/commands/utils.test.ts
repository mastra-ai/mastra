import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type * as ExecaModule from 'execa';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    readJSON: vi.fn(),
  },
}));

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mock/path/to/package.json'),
}));

describe('getVersionTag', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  test('returns "beta" when CLI version matches beta dist-tag', async () => {
    const { execa } = await import('execa');
    const fsExtra = (await import('fs-extra')).default;

    vi.mocked(fsExtra.readJSON).mockResolvedValue({ version: '1.0.0-beta.5' });
    vi.mocked(execa).mockResolvedValue({
      stdout: 'beta: 1.0.0-beta.5\nlatest: 0.18.6',
      stderr: '',
      command: '',
      escapedCommand: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      killed: false,
    } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBe('beta');
  });

  test('returns "latest" when CLI version matches latest dist-tag', async () => {
    const { execa } = await import('execa');
    const fsExtra = (await import('fs-extra')).default;

    vi.mocked(fsExtra.readJSON).mockResolvedValue({ version: '0.18.6' });
    vi.mocked(execa).mockResolvedValue({
      stdout: 'beta: 1.0.0-beta.5\nlatest: 0.18.6',
      stderr: '',
      command: '',
      escapedCommand: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      killed: false,
    } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBe('latest');
  });

  test('returns undefined when version does not match any dist-tag', async () => {
    const { execa } = await import('execa');
    const fsExtra = (await import('fs-extra')).default;

    vi.mocked(fsExtra.readJSON).mockResolvedValue({ version: '0.0.0-local' });
    vi.mocked(execa).mockResolvedValue({
      stdout: 'beta: 1.0.0-beta.5\nlatest: 0.18.6',
      stderr: '',
      command: '',
      escapedCommand: '',
      exitCode: 0,
      failed: false,
      timedOut: false,
      killed: false,
    } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBeUndefined();
  });

  test('returns undefined when npm command fails', async () => {
    const { execa } = await import('execa');
    const fsExtra = (await import('fs-extra')).default;

    vi.mocked(fsExtra.readJSON).mockResolvedValue({ version: '1.0.0-beta.5' });
    vi.mocked(execa).mockRejectedValue(new Error('npm command failed'));

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBeUndefined();
  });

  test('returns undefined when package.json cannot be read', async () => {
    const fsExtra = (await import('fs-extra')).default;

    vi.mocked(fsExtra.readJSON).mockRejectedValue(new Error('File not found'));

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag();

    expect(tag).toBeUndefined();
  });

  test('uses an explicitly supplied version without resolving package metadata', async () => {
    const { execa } = await import('execa');
    const fsExtra = (await import('fs-extra')).default;
    vi.mocked(execa).mockResolvedValue({ stdout: 'snapshot: 1.2.3-snapshot.4' } as any);

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag('1.2.3-snapshot.4');

    expect(tag).toBe('snapshot');
    expect(fsExtra.readJSON).not.toHaveBeenCalled();
    expect(execa).toHaveBeenCalledWith('npm', ['dist-tag', 'ls', 'mastra'], expect.any(Object));
  });

  test('warns and falls back to latest when explicit create version lookup fails', async () => {
    const { execa } = await import('execa');
    vi.mocked(execa).mockRejectedValue(new Error('registry unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { getVersionTag } = await import('./utils');
    const tag = await getVersionTag('1.2.3');

    expect(tag).toBe('latest');
    expect(consoleSpy).toHaveBeenCalledWith('We could not resolve the mastra version tag, falling back to "latest"');
  });
});

describe('gitInit', () => {
  test('creates a protected initial commit without inheriting global identity, signing, or hooks', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-git-init-'));
    const project = path.join(root, 'project');
    const home = path.join(root, 'home');
    const globalHooks = path.join(root, 'global-hooks');
    const globalExcludes = path.join(root, 'global-excludes');
    const hookMarker = path.join(root, 'hook-ran');
    const globalConfig = path.join(root, 'global.gitconfig');
    await Promise.all([fs.mkdir(project), fs.mkdir(home), fs.mkdir(globalHooks)]);
    await fs.writeFile(path.join(project, 'index.ts'), 'export const value = true;\n');
    await fs.writeFile(path.join(project, '.env'), 'SECRET=private\n');
    await fs.writeFile(path.join(project, '.env.local'), 'LOCAL_SECRET=private\n');
    await fs.writeFile(path.join(project, '.env.example'), 'SECRET=\n');
    await fs.writeFile(path.join(project, '.env.test.example'), 'TEST_SECRET=\n');
    await fs.writeFile(path.join(globalHooks, 'post-commit'), `#!/bin/sh\ntouch ${JSON.stringify(hookMarker)}\n`);
    await fs.chmod(path.join(globalHooks, 'post-commit'), 0o755);
    await fs.writeFile(globalExcludes, 'index.ts\n');
    await fs.writeFile(
      globalConfig,
      `[commit]\n\tgpgSign = true\n[core]\n\thooksPath = ${globalHooks}\n\texcludesFile = ${globalExcludes}\n`,
    );

    const originalEnv = {
      HOME: process.env.HOME,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    };
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = path.join(home, '.config');
    process.env.GIT_CONFIG_GLOBAL = globalConfig;

    try {
      const actualExecaModule = await vi.importActual<typeof ExecaModule>('execa');
      const mockedExecaModule = await import('execa');
      vi.mocked(mockedExecaModule.execa).mockImplementation(actualExecaModule.execa as typeof mockedExecaModule.execa);
      const { gitInit } = await import('./utils');

      await gitInit({ cwd: project });

      const gitCalls = vi.mocked(mockedExecaModule.execa).mock.calls as unknown as Array<
        [command: string, args: string[], options?: unknown]
      >;
      const commitCall = gitCalls.find(([, args]) => args.includes('commit'));
      expect(commitCall).toBeDefined();
      expect(commitCall?.[1]).not.toEqual(expect.arrayContaining([expect.stringContaining('"')]));
      for (const [command, args, options] of gitCalls) {
        if (command !== 'git' || !args.some(argument => ['init', 'add', 'commit'].includes(argument))) continue;
        expect(options).toEqual(
          expect.objectContaining({
            env: expect.objectContaining({
              GIT_CONFIG_NOSYSTEM: '1',
              GIT_CONFIG_COUNT: '0',
              GIT_CONFIG_GLOBAL: expect.stringContaining('mastra-git-config-'),
            }),
          }),
        );
      }
      const hooksArgument = commitCall?.[1].find(argument => argument.startsWith('core.hooksPath='));
      expect(hooksArgument).toBeDefined();
      expect(await fs.stat(hooksArgument!.slice('core.hooksPath='.length)).catch(() => undefined)).toBeUndefined();

      const { stdout: commitCount } = await actualExecaModule.execa('git', ['rev-list', '--count', 'HEAD'], {
        cwd: project,
      });
      expect(commitCount).toBe('1');
      const { stdout: author } = await actualExecaModule.execa('git', ['log', '-1', '--format=%an <%ae>'], {
        cwd: project,
      });
      expect(author).toBe('Mastra <noreply@mastra.ai>');
      const { stdout: files } = await actualExecaModule.execa('git', ['ls-files'], { cwd: project });
      expect(files.split('\n')).toEqual(['.env.example', '.env.test.example', 'index.ts']);
      expect(await fs.readFile(path.join(project, '.git', 'info', 'exclude'), 'utf8')).toContain(
        '.env\n.env.*\n!.env.example\n!.env.*.example',
      );
      await expect(fs.stat(path.join(project, '.gitignore'))).rejects.toThrow();
      await expect(fs.stat(hookMarker)).rejects.toThrow();

      for (const key of ['user.name', 'user.email', 'commit.gpgSign', 'core.hooksPath']) {
        const result = await actualExecaModule.execa('git', ['config', '--local', '--get', key], {
          cwd: project,
          reject: false,
        });
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe('');
      }
    } finally {
      if (originalEnv.HOME === undefined) delete process.env.HOME;
      else process.env.HOME = originalEnv.HOME;
      if (originalEnv.XDG_CONFIG_HOME === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = originalEnv.XDG_CONFIG_HOME;
      if (originalEnv.GIT_CONFIG_GLOBAL === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = originalEnv.GIT_CONFIG_GLOBAL;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
