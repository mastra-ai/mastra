import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execa: execaMock }));

import { getEntryPackageRoot, getPluginDependencyRoots, installPluginDependencies } from '../dependencies.js';

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function makePluginRoot(): string {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-deps-'));
  tempDir = pluginRoot;
  return pluginRoot;
}

function writePackageJson(pluginRoot: string, packageJson: Record<string, unknown> = {}): void {
  fs.writeFileSync(path.join(pluginRoot, 'package.json'), JSON.stringify(packageJson));
}

describe('installPluginDependencies', () => {
  it('does not run a package manager when package.json is absent', async () => {
    const pluginRoot = makePluginRoot();

    await expect(installPluginDependencies(pluginRoot)).resolves.toBe(false);

    expect(execaMock).not.toHaveBeenCalled();
  });

  it('uses pnpm when packageManager declares pnpm', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager: 'pnpm@10.0.0' });

    await expect(installPluginDependencies(pluginRoot)).resolves.toBe(true);

    expect(execaMock).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({ cwd: pluginRoot }));
  });

  it('uses pnpm when pnpm-lock.yaml is present', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot);
    fs.writeFileSync(path.join(pluginRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith(
      'pnpm',
      ['install', '--frozen-lockfile'],
      expect.objectContaining({ cwd: pluginRoot }),
    );
  });

  it('uses npm ci when npm packageManager has a lockfile', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager: 'npm@11.0.0' });
    fs.writeFileSync(path.join(pluginRoot, 'package-lock.json'), '{}');

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('npm', ['ci'], expect.objectContaining({ cwd: pluginRoot }));
  });

  it('prefers packageManager over conflicting lockfiles', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager: 'npm@11.0.0' });
    fs.writeFileSync(path.join(pluginRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('npm', ['install'], expect.objectContaining({ cwd: pluginRoot }));
  });

  it('falls back to npm install when only package.json is present', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot);

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith(
      'npm',
      ['install'],
      expect.objectContaining({
        cwd: pluginRoot,
        env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }),
        stdout: 'ignore',
        stderr: 'ignore',
      }),
    );
  });

  it('surfaces package manager failures', async () => {
    const pluginRoot = makePluginRoot();
    const error = new Error('install failed');
    writePackageJson(pluginRoot);
    execaMock.mockRejectedValueOnce(error);

    await expect(installPluginDependencies(pluginRoot)).rejects.toThrow(error);
  });

  it('finds dependency roots for nested entry packages', () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, '.mastracode/plugins/sources/local/alexandria');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@10.0.0' });
    fs.mkdirSync(path.join(nestedRoot, 'src'), { recursive: true });
    writePackageJson(nestedRoot);

    expect(getPluginDependencyRoots(pluginRoot, '.mastracode/plugins/sources/local/alexandria/src/index.ts')).toEqual([
      pluginRoot,
      nestedRoot,
    ]);
    expect(getEntryPackageRoot(pluginRoot, '.mastracode/plugins/sources/local/alexandria/src/index.ts')).toBe(
      nestedRoot,
    );
  });

  it('inherits the checkout package manager for nested entry packages', async () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, '.mastracode/plugins/sources/local/alexandria');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@11.5.1' });
    fs.writeFileSync(path.join(pluginRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
    fs.mkdirSync(path.join(nestedRoot, 'src'), { recursive: true });
    writePackageJson(nestedRoot);

    await installPluginDependencies(nestedRoot, pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('pnpm', ['install'], expect.objectContaining({ cwd: nestedRoot }));
  });

  it('uses frozen install for nested entry packages with their own lockfile', async () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, '.mastracode/plugins/sources/local/alexandria');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@11.5.1' });
    fs.mkdirSync(nestedRoot, { recursive: true });
    writePackageJson(nestedRoot);
    fs.writeFileSync(path.join(nestedRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    await installPluginDependencies(nestedRoot, pluginRoot);

    expect(execaMock).toHaveBeenCalledWith(
      'pnpm',
      ['install', '--frozen-lockfile'],
      expect.objectContaining({ cwd: nestedRoot }),
    );
  });
});
