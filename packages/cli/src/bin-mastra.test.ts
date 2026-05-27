import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const TEST_TMP_ROOT = join(currentDir, '.test-tmp');
const binPath = join(currentDir, '..', 'bin', 'mastra.mjs');

async function writeFixtureFile(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

describe('mastra bin source-mode guard', () => {
  let testDir: string;
  let fixtureBin: string;

  beforeEach(async () => {
    await mkdir(TEST_TMP_ROOT, { recursive: true });
    testDir = await mkdtemp(join(TEST_TMP_ROOT, 'mastra-bin-'));
    fixtureBin = join(testDir, 'packages', 'cli', 'bin', 'mastra.mjs');

    await mkdir(join(testDir, 'packages', 'cli', 'bin'), { recursive: true });
    await cp(binPath, fixtureBin);
    await writeFixtureFile(join(testDir, 'packages', 'cli', 'dist', 'index.js'), "console.log('dist-entry');\n");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(TEST_TMP_ROOT, { recursive: true, force: true });
  });

  it('runs the TypeScript entry when source mode is requested and the CLI is linked to a repo checkout', async () => {
    await writeFixtureFile(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeFixtureFile(join(testDir, 'packages', 'core', 'src', 'index.ts'), 'export {};\n');
    await writeFixtureFile(join(testDir, 'packages', 'cli', 'src', 'index.ts'), "console.log(process.env.MASTRA_SOURCE_MODE);\n");

    const result = spawnSync(process.execPath, [fixtureBin], {
      cwd: testDir,
      env: { ...process.env, MASTRA_REPO_RUN_FROM_SOURCE: 'true' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('1');
  });

  it('falls back to the dist entry when source mode is requested without repo source files', () => {
    const result = spawnSync(process.execPath, [fixtureBin], {
      cwd: testDir,
      env: { ...process.env, MASTRA_REPO_RUN_FROM_SOURCE: 'true' },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('dist-entry');
  });

  it('falls back to the dist entry when source mode is not requested', async () => {
    await writeFixtureFile(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    await writeFixtureFile(join(testDir, 'packages', 'core', 'src', 'index.ts'), 'export {};\n');
    await writeFixtureFile(join(testDir, 'packages', 'cli', 'src', 'index.ts'), "console.log('source-entry');\n");

    const env = { ...process.env };
    delete env.MASTRA_REPO_RUN_FROM_SOURCE;
    delete env.MASTRA_SOURCE_MODE;

    const result = spawnSync(process.execPath, [fixtureBin], {
      cwd: testDir,
      env,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('dist-entry');
  });
});
