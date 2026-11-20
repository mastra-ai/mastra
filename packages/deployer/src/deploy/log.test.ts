import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createChildProcessLogger, windowsShimTarget } from './log';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('windows package manager shims', () => {
  it('reads the Node script a npm cmd shim launches', () => {
    const shim = [
      '@ECHO off',
      'SET dp0=%~dp0',
      'IF EXIST "%dp0%\\node.exe" (',
      '  SET "_prog=%dp0%\\node.exe"',
      ') ELSE (',
      '  SET "_prog=node"',
      ')',
      '"%_prog%" "%dp0%\\node_modules\\npm\\bin\\npm-cli.js" %*',
    ].join('\r\n');

    expect(windowsShimTarget(shim, 'C:\\Program Files\\nodejs')).toEqual({
      nodePath: 'C:\\Program Files\\nodejs\\node.exe',
      scriptPath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    });
  });
});

describe('createChildProcessLogger', () => {
  it('passes shell syntax through as one argument', async () => {
    // Technical: spawn without a shell, so $(...) in an argument is not executed. (SEC-328)
    const root = await mkdtemp(join(tmpdir(), 'deployer-argv-'));
    roots.push(root);
    const marker = join(root, 'pwned');
    const argument = `$(touch ${marker}) spaced 'quotes'`;
    const run = createChildProcessLogger({
      logger: { info() {}, error() {}, warn() {}, debug() {}, trackException() {} } as never,
      root,
    });

    const result = await run({
      cmd: process.execPath,
      args: ['-e', 'process.stdout.write(process.argv[1] ?? "")', argument],
      env: { PATH: process.env.PATH ?? '' },
    });

    expect(result).toMatchObject({ success: true, stdout: argument });
    expect(existsSync(marker)).toBe(false);
  });

  it('packs a package into a destination whose name is shell syntax', async () => {
    const { DepsService } = await import('../services/deps');
    const root = await mkdtemp(join(tmpdir(), 'deployer-pack-'));
    roots.push(root);
    const destination = join(root, 'out $(echo pwned)');
    await mkdir(destination);
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'widget', version: '1.0.0', type: 'module' }));
    await writeFile(join(root, 'index.js'), 'export const value = 1;\n');
    await writeFile(join(root, 'package-lock.json'), '{}\n');

    const result = await new DepsService(root).pack({
      dir: root,
      destination,
      sanitizedName: 'widget',
      version: '1.0.0',
    });

    expect(result).toMatchObject({ success: true });
    expect(existsSync(join(destination, 'widget-1.0.0.tgz'))).toBe(true);
    expect(existsSync(join(root, 'pwned'))).toBe(false);
  });
});
