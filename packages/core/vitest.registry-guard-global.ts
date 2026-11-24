import fs from 'node:fs';
import path from 'node:path';

// Gives this run its own parent dir for the throwaway HOME dirs created by
// vitest.registry-guard-setup.ts, and removes it afterwards. Workers are stopped without a process
// 'exit' event, so they can't clean up after themselves. Per-run, so a concurrent run in the same
// checkout keeps its homes.
let runDir: string | undefined;

export function setup() {
  const homesDir = path.join(__dirname, 'node_modules', '.cache', 'test-homes');
  fs.mkdirSync(homesDir, { recursive: true });
  runDir = fs.mkdtempSync(path.join(homesDir, 'run-'));
  process.env.MASTRA_CORE_TEST_HOMES_DIR = runDir;
}

export function teardown() {
  if (runDir) fs.rmSync(runDir, { recursive: true, force: true });
}
