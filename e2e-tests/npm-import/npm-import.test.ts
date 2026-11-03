import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { installWithRetry } from '../_local-registry-setup/install.js';

const templateDir = fileURLToPath(new URL('./template/', import.meta.url));
const template = JSON.parse(await readFile(join(templateDir, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};
const packages = Object.keys(template.dependencies);

let appDir: string;

beforeAll(
  async () => {
    appDir = await mkdtemp(join(tmpdir(), 'mastra-npm-import-'));
    await cp(templateDir, appDir, { recursive: true });
    await writeFile(join(appDir, '.npmrc'), `registry=${inject('registry')}\n`);
    installWithRetry('npm', ['install', '--no-audit', '--no-fund'], { cwd: appDir });
  },
  10 * 60 * 1000,
);

afterAll(async () => {
  await rm(appDir, { recursive: true, force: true });
});

describe.for(packages)('%s', pkg => {
  it('loads with import', async () => {
    const result = await execa(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(pkg)})`],
      {
        cwd: appDir,
        reject: false,
      },
    );
    expect(result.exitCode, result.stderr).toBe(0);
  });

  it('loads with require', async () => {
    const result = await execa(process.execPath, ['-e', `require(${JSON.stringify(pkg)})`], {
      cwd: appDir,
      reject: false,
    });
    expect(result.exitCode, result.stderr).toBe(0);
  });
});
