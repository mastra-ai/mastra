import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, rm } from 'node:fs/promises';
import { execa } from 'execa';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = join(__dirname, '..');

/**
 * Delete stale SQLite database files so every run starts fresh.
 */
async function cleanDatabase() {
  const suffixes = ['', '-journal', '-shm', '-wal'];
  const dirs = [projectDir, join(projectDir, '.mastra', 'output')];
  for (const dir of dirs) {
    for (const suffix of suffixes) {
      await rm(join(dir, `test.db${suffix}`), { force: true }).catch(() => {});
    }
  }
}

/**
 * Wipe the workspace directory so tests start with a clean slate.
 *
 * Must match the basePath in src/mastra/index.ts:
 *   new LocalFilesystem({ basePath: './test-workspace' })
 *
 * LocalFilesystem resolves relative paths against process.cwd(),
 * which is projectDir when the Playwright webServer starts.
 */
async function cleanWorkspace() {
  const wsDir = join(projectDir, 'test-workspace');
  await rm(wsDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(wsDir, { recursive: true });
}

export default async function globalSetup() {
  await cleanDatabase();
  await cleanWorkspace();

  const mastraBin = join(projectDir, 'node_modules', '.bin', 'mastra');
  console.log('[smoke:ui] Running mastra build --studio...');
  const result = await execa(mastraBin, ['build', '--studio'], {
    cwd: projectDir,
    stdio: 'pipe',
    env: process.env,
    reject: false,
  });
  if (result.exitCode !== 0) {
    console.error('[smoke:ui] Build failed:', result.stderr || result.stdout);
    throw new Error(`mastra build failed with exit code ${result.exitCode}`);
  }
  console.log('[smoke:ui] Build complete.');
}
