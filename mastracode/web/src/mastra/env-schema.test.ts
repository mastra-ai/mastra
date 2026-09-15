import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('.env.schema', () => {
  it('accepts an omitted Linear integration without a dependency cycle', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'mastracode-web-env-'));
    tempDirectories.push(cwd);
    copyFileSync(join(packageRoot, '.env.schema'), join(cwd, '.env.schema'));

    const env = { ...process.env };
    delete env.LINEAR_CLIENT_ID;
    delete env.LINEAR_CLIENT_SECRET;

    expect(() =>
      execFileSync(join(packageRoot, 'node_modules/.bin/varlock'), ['run', '--', process.execPath, '-e', ''], {
        cwd,
        env,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
