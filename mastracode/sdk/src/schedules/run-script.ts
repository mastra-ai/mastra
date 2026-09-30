/**
 * Runs a schedule's script file at fire time.
 *
 * The file path is always passed as the literal command (or as the single
 * argument to a fixed interpreter) — never through a shell string — so the
 * user's extra prompt can never be interpolated into a command line.
 */
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RunScript, ScriptResult } from './prompt.js';

/** Interpreter for scripts that lack an executable bit, keyed by extension. */
const INTERPRETERS: Record<string, () => string> = {
  '.sh': () => '/bin/sh',
  '.js': () => process.execPath,
  '.mjs': () => process.execPath,
  '.cjs': () => process.execPath,
  '.ts': () => process.execPath,
  '.py': () => 'python3',
};

const MAX_OUTPUT_BYTES = 1024 * 1024;

export function isExecutableFile(absPath: string): boolean {
  try {
    fs.accessSync(absPath, fs.constants.X_OK);
    return fs.statSync(absPath).isFile();
  } catch {
    return false;
  }
}

export function resolveScriptCommand(absPath: string): { command: string; args: string[] } {
  if (isExecutableFile(absPath)) return { command: absPath, args: [] };
  const interpreter = INTERPRETERS[path.extname(absPath).toLowerCase()];
  if (!interpreter) {
    throw new Error(`${absPath} is not executable and has no known interpreter`);
  }
  return { command: interpreter(), args: [absPath] };
}

export const runScript: RunScript = async (absPath, { cwd, timeoutMs }) => {
  const { command, args } = resolveScriptCommand(absPath);
  return new Promise<ScriptResult>((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ stdout, stderr, exitCode: 0 });
          return;
        }
        const spawnError = error as NodeJS.ErrnoException & { code?: number | string; killed?: boolean };
        if (typeof spawnError.code === 'number') {
          resolve({ stdout, stderr, exitCode: spawnError.code });
          return;
        }
        if (spawnError.killed) {
          resolve({ stdout, stderr: `${stderr}\n[timed out after ${timeoutMs}ms]`.trim(), exitCode: null });
          return;
        }
        reject(error);
      },
    );
  });
};
