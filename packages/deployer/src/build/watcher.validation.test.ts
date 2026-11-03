import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { getInputOptions } from './watcher';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

/** An app importing a workspace package that throws while it loads, `loadDelayMs` after being imported. */
async function createAppWithBrokenWorkspacePackage(loadDelayMs: number) {
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, 'mastra-dev-validation-'));
  tempDirs.push(tempDir);

  const appDir = join(tempDir, 'apps', 'app');
  const workspacePackageDir = join(tempDir, 'packages', 'broken');
  const entryFile = join(appDir, 'src', 'mastra', 'index.ts');
  await mkdir(join(appDir, 'src', 'mastra'), { recursive: true });
  await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
  await mkdir(join(workspacePackageDir, 'src'), { recursive: true });
  await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
  await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
  await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
  await writeFile(
    join(workspacePackageDir, 'package.json'),
    JSON.stringify({ name: '@internal/broken', version: '1.0.0', type: 'module', main: './src/index.js' }),
  );
  await writeFile(
    join(workspacePackageDir, 'src', 'index.js'),
    `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${loadDelayMs});\nexport const value = globalThis.missing.value;`,
  );
  await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'broken'));
  await writeFile(entryFile, `import { value } from '@internal/broken';\nexport const mastra = { value };`);
  const outputDir = join(appDir, '.mastra', '.build');
  await mkdir(outputDir, { recursive: true });

  return { tempDir, entryFile, outputDir };
}

async function inDir<T>(dir: string, run: () => Promise<T>): Promise<T> {
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    return await run();
  } finally {
    process.chdir(originalCwd);
  }
}

// `mastra dev` loads each optimized workspace package in a child process to explain load failures. It must not hold
// back the first build for that, but the explanation still has to reach the user.
describe('dev watcher validation', () => {
  it('returns before the workspace package checks finish and reports their failure afterwards', async () => {
    const { tempDir, entryFile, outputDir } = await createAppWithBrokenWorkspacePackage(3000);

    const errors: unknown[] = [];
    await inDir(tempDir, () =>
      getInputOptions(entryFile, 'node', undefined, { outputDir, onValidationError: e => errors.push(e) }),
    );
    expect(errors).toEqual([]);

    await expect.poll(() => errors.length, { timeout: 15000 }).toBe(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toContain('We found an error in the @internal/broken workspace package');
  }, 30000);

  it('fails with the same error when the caller waits for the checks', async () => {
    const { tempDir, entryFile, outputDir } = await createAppWithBrokenWorkspacePackage(0);

    const reported: unknown[] = [];
    await inDir(tempDir, () =>
      getInputOptions(entryFile, 'node', undefined, { outputDir, onValidationError: e => reported.push(e) }),
    );
    await expect.poll(() => reported.length, { timeout: 15000 }).toBe(1);

    const thrown = await inDir(tempDir, () => getInputOptions(entryFile, 'node', undefined, { outputDir })).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe((reported[0] as Error).message);
  }, 30000);
});
