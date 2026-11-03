import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { glob } from 'tinyglobby';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { installWithRetry } from '../_local-registry-setup/install.js';

const templatesDir = fileURLToPath(new URL('./template/', import.meta.url));
const apps = readdirSync(templatesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

describe.for(apps)('%s', app => {
  const templateDir = join(templatesDir, app);
  const template = JSON.parse(readFileSync(join(templateDir, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const packages = Object.keys(template.dependencies);

  let appDir: string;

  beforeAll(
    async () => {
      appDir = await mkdtemp(join(tmpdir(), `mastra-npm-import-${app}-`));
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
        { cwd: appDir, reject: false },
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

  it('installs one copy of @opentelemetry/api', async () => {
    const copies = await glob('**/node_modules/@opentelemetry/api/package.json', { cwd: appDir });
    expect(copies).toEqual(['node_modules/@opentelemetry/api/package.json']);
  });

  it.runIf(existsSync(join(templateDir, 'export-span.mjs')))('sends a span over HTTP/protobuf', async () => {
    const result = await execa(process.execPath, ['export-span.mjs'], { cwd: appDir, reject: false });
    expect(result.exitCode, result.stderr).toBe(0);
    const requests = JSON.parse(result.stdout) as { url: string; contentType: string; bytes: number }[];
    expect(requests, result.stderr).toHaveLength(1);
    expect(requests[0]).toMatchObject({ url: '/v1/traces', contentType: 'application/x-protobuf' });
    expect(requests[0].bytes).toBeGreaterThan(0);
  });
});
