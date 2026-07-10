import { EventEmitter } from 'node:events';
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

function expectedPnpmArgs(frozen = false): string[] {
  return ['install', '--ignore-workspace', ...(frozen ? ['--frozen-lockfile'] : []), '--ignore-scripts'];
}

describe('installPluginDependencies', () => {
  it('does not run a package manager when package.json is absent', async () => {
    const pluginRoot = makePluginRoot();

    await expect(installPluginDependencies(pluginRoot)).resolves.toBe(false);

    expect(execaMock).not.toHaveBeenCalled();
  });

  it.each(['pnpm@10.24.0', 'pnpm@11.8.0'])('accepts an exact declaration: %s', async packageManager => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager });

    await expect(installPluginDependencies(pluginRoot)).resolves.toBe(true);

    expect(execaMock).toHaveBeenCalledWith('pnpm', expectedPnpmArgs(), expect.objectContaining({ cwd: pluginRoot }));
  });

  it.each([
    ['absent', undefined],
    ['non-string', 10],
    ['npm', 'npm@11.0.0'],
    ['Yarn', 'yarn@4.0.0'],
    ['Bun', 'bun@1.0.0'],
    ['unknown manager', 'definitely-missing-pm@1.0.0'],
    ['missing version', 'pnpm'],
    ['whitespace', ' pnpm@10.0.0'],
    ['major only', 'pnpm@10'],
    ['major and minor only', 'pnpm@10.0'],
    ['range', 'pnpm@^10.0.0'],
    ['tag', 'pnpm@latest'],
    ['prerelease', 'pnpm@10.0.0-rc.1'],
    ['build metadata', 'pnpm@10.0.0+build.1'],
    ['malformed version', 'pnpm@10.x.0'],
  ])('rejects an %s packageManager declaration', async (_label, packageManager) => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, packageManager === undefined ? {} : { packageManager });

    await expect(installPluginDependencies(pluginRoot)).rejects.toThrow(
      `Plugin at ${pluginRoot} must declare an exact pnpm version in package.json using "packageManager": "pnpm@x.y.z".`,
    );
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('uses a frozen install when the dependency root has pnpm-lock.yaml', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager: 'pnpm@10.24.0' });
    fs.writeFileSync(path.join(pluginRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith(
      'pnpm',
      expectedPnpmArgs(true),
      expect.objectContaining({ cwd: pluginRoot }),
    );
  });

  it('ignores other lockfile formats when an exact pnpm version is declared', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager: 'pnpm@11.8.0' });
    fs.writeFileSync(path.join(pluginRoot, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(pluginRoot, 'yarn.lock'), '');

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('pnpm', expectedPnpmArgs(), expect.objectContaining({ cwd: pluginRoot }));
  });

  it('streams output and forwards cancellation while preserving non-interactive execution', async () => {
    const pluginRoot = makePluginRoot();
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const output: string[] = [];
    const signal = new AbortController().signal;
    writePackageJson(pluginRoot, { packageManager: 'pnpm@10.24.0' });
    execaMock.mockReturnValueOnce(Object.assign(Promise.resolve({}), { stdout, stderr }));

    const install = installPluginDependencies(pluginRoot, pluginRoot, {
      onOutput: chunk => output.push(chunk.toString()),
      signal,
    });
    stdout.emit('data', 'stdout line\n');
    stderr.emit('data', 'stderr line\n');
    await install;

    expect(output).toEqual(['stdout line\n', 'stderr line\n']);
    expect(execaMock).toHaveBeenCalledWith(
      'pnpm',
      expectedPnpmArgs(),
      expect.objectContaining({
        env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }),
        stdout: 'pipe',
        stderr: 'pipe',
        cancelSignal: signal,
      }),
    );
  });

  it('surfaces install failures', async () => {
    const pluginRoot = makePluginRoot();
    const error = new Error('install failed');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@10.24.0' });
    execaMock.mockRejectedValueOnce(error);

    await expect(installPluginDependencies(pluginRoot)).rejects.toThrow(error);
  });

  it('disables lifecycle scripts during install', async () => {
    const pluginRoot = makePluginRoot();
    writePackageJson(pluginRoot, { packageManager: 'pnpm@11.8.0' });

    await installPluginDependencies(pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('pnpm', expectedPnpmArgs(), expect.objectContaining({ cwd: pluginRoot }));
  });

  it('finds dependency roots for nested entry packages', () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, '.mastracode/plugins/sources/local/alexandria');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@10.24.0' });
    fs.mkdirSync(path.join(nestedRoot, 'src'), { recursive: true });
    writePackageJson(nestedRoot, { packageManager: 'pnpm@11.8.0' });

    expect(getPluginDependencyRoots(pluginRoot, '.mastracode/plugins/sources/local/alexandria/src/index.ts')).toEqual([
      pluginRoot,
      nestedRoot,
    ]);
    expect(getEntryPackageRoot(pluginRoot, '.mastracode/plugins/sources/local/alexandria/src/index.ts')).toBe(
      nestedRoot,
    );
  });

  it('inherits the checkout declaration for nested entry packages', async () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, '.mastracode/plugins/sources/local/alexandria');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@11.8.0' });
    fs.mkdirSync(path.join(nestedRoot, 'src'), { recursive: true });
    writePackageJson(nestedRoot);

    await installPluginDependencies(nestedRoot, pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('pnpm', expectedPnpmArgs(), expect.objectContaining({ cwd: nestedRoot }));
  });

  it('prefers the dependency-root declaration over the checkout declaration', async () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, 'nested');
    writePackageJson(pluginRoot, { packageManager: 'npm@11.0.0' });
    fs.mkdirSync(nestedRoot);
    writePackageJson(nestedRoot, { packageManager: 'pnpm@10.24.0' });

    await installPluginDependencies(nestedRoot, pluginRoot);

    expect(execaMock).toHaveBeenCalledWith('pnpm', expectedPnpmArgs(), expect.objectContaining({ cwd: nestedRoot }));
  });

  it('uses a frozen install for nested entry packages with their own lockfile', async () => {
    const pluginRoot = makePluginRoot();
    const nestedRoot = path.join(pluginRoot, '.mastracode/plugins/sources/local/alexandria');
    writePackageJson(pluginRoot, { packageManager: 'pnpm@11.8.0' });
    fs.mkdirSync(nestedRoot, { recursive: true });
    writePackageJson(nestedRoot);
    fs.writeFileSync(path.join(nestedRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    await installPluginDependencies(nestedRoot, pluginRoot);

    expect(execaMock).toHaveBeenCalledWith(
      'pnpm',
      expectedPnpmArgs(true),
      expect.objectContaining({ cwd: nestedRoot }),
    );
  });
});
