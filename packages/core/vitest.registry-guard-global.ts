import fs from 'node:fs';
import path from 'node:path';

// Removes the throwaway HOME dirs created by vitest.registry-guard-setup.ts. Workers are stopped
// without a process 'exit' event, so they can't clean up after themselves.
export function teardown() {
  fs.rmSync(path.join(__dirname, 'node_modules', '.cache', 'test-homes'), { recursive: true, force: true });
}
