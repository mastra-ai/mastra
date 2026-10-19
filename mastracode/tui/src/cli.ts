#!/usr/bin/env node
/**
 * CLI entry. Restarts Node with Mastra Code's heap flags (see heap-flags.ts) before the app loads,
 * then runs main.ts. Kept to static imports of tiny modules so the restart costs only Node's own boot.
 */
import { heapFlagRelaunchArgv } from './heap-flags.js';

const relaunchArgv = heapFlagRelaunchArgv(process);
// Same in-place exec as main.ts's relaunch(); without it (Windows, older Node) we run without the flags.
const execve = (process as { execve?: (file: string, args: string[], env: NodeJS.ProcessEnv) => never }).execve;
if (relaunchArgv && execve) {
  try {
    execve(process.execPath, relaunchArgv, process.env);
  } catch {
    // The exec itself failed (e.g. a sandbox forbids it): carry on in this process without the flags.
  }
}

// No top-level await: this entry is also built as CommonJS.
import('./main.js').catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
