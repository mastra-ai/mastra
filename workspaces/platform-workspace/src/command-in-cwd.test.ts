import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commandInCwd } from './sandbox.js';

function run(script: string, from: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('/bin/bash', ['-c', script], { cwd: from, encoding: 'utf8', stdio: 'pipe' });
    return { status: 0, stdout: stdout.trim(), stderr: '' };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { status: e.status, stdout: e.stdout.trim(), stderr: e.stderr.trim() };
  }
}

describe('commandInCwd', () => {
  let root: string;
  let workdir: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'cwd-')));
    workdir = join(root, 'workspace');
    mkdirSync(join(workdir, 'repo', 'src'), { recursive: true });
    mkdirSync(join(root, 'outside'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves the command alone without a cwd or when cwd is the working directory', () => {
    expect(commandInCwd('pwd', undefined, workdir)).toBe('pwd');
    expect(commandInCwd('pwd', '', workdir)).toBe('pwd');
    expect(commandInCwd('pwd', `${workdir}/`, workdir)).toBe('pwd');
    expect(commandInCwd('pwd', '.', workdir)).toBe('pwd');
  });

  it('resolves a relative cwd under the working directory', () => {
    expect(run(commandInCwd('pwd', 'repo/src', workdir), workdir)).toMatchObject({
      status: 0,
      stdout: join(workdir, 'repo', 'src'),
    });
  });

  it('uses an absolute cwd that exists, inside or outside the working directory', () => {
    expect(run(commandInCwd('pwd', join(workdir, 'repo'), workdir), workdir).stdout).toBe(join(workdir, 'repo'));
    expect(run(commandInCwd('pwd', join(root, 'outside'), workdir), workdir).stdout).toBe(join(root, 'outside'));
  });

  it('maps a missing absolute cwd under the working directory, like the file tools do', () => {
    expect(run(commandInCwd('pwd', '/repo', workdir), workdir)).toMatchObject({
      status: 0,
      stdout: join(workdir, 'repo'),
    });
  });

  it('fails as a command with a clear message when the directory does not exist', () => {
    const result = run(commandInCwd('echo ran', 'nope', workdir), workdir);
    expect(result).toEqual({ status: 1, stdout: '', stderr: `Working directory not found: ${join(workdir, 'nope')}` });

    const absolute = run(commandInCwd('echo ran', '/nope', workdir), workdir);
    expect(absolute.status).toBe(1);
    expect(absolute.stdout).toBe('');
    expect(absolute.stderr).toBe(`Working directory not found: /nope (also tried ${join(workdir, 'nope')})`);
  });

  it('quotes directories with spaces and quotes', () => {
    const dir = join(workdir, "it's a dir");
    mkdirSync(dir);
    expect(run(commandInCwd('pwd', "it's a dir", workdir), workdir).stdout).toBe(dir);
  });

  it('runs multi-line commands in the target directory', () => {
    expect(run(commandInCwd('cd src\npwd', 'repo', workdir), workdir).stdout).toBe(join(workdir, 'repo', 'src'));
  });
});
