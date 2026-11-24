import fs from 'node:fs';
import path from 'node:path';

// Gives this run its own parent dir for the throwaway HOME dirs created by
// vitest.registry-guard-setup.ts, and removes it afterwards. Workers are stopped without a process
// 'exit' event, so they can't clean up after themselves. Per-run, so a concurrent run in the same
// checkout keeps its homes. Registered on both core projects (the root config only keeps nested
// projects), so setup may run twice in one run; the env var makes it idempotent.
const ENV = 'MASTRA_CORE_TEST_HOMES_DIR';

export function setup() {
  if (process.env[ENV]) return;
  const homesDir = path.join(__dirname, 'node_modules', '.cache', 'test-homes');
  fs.mkdirSync(homesDir, { recursive: true });
  process.env[ENV] = fs.mkdtempSync(path.join(homesDir, 'run-'));
}

export function teardown() {
  const runDir = process.env[ENV];
  if (runDir) fs.rmSync(runDir, { recursive: true, force: true });
  // Watch mode can restart Vitest in this process; the next setup must create a fresh dir.
  delete process.env[ENV];
}
