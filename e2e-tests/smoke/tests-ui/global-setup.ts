import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
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

export default async function globalSetup() {
  await cleanDatabase();

  const mastraBin = join(projectDir, 'node_modules', '.bin', 'mastra');
  console.log('[smoke:ui] Running mastra build --studio...');
  await execa(mastraBin, ['build', '--studio'], {
    cwd: projectDir,
    stdio: 'pipe',
    env: process.env,
  });
  console.log('[smoke:ui] Build complete.');
}
