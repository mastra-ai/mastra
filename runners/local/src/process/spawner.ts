import { spawn  } from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import type { LogStreamCallback } from '@mastra/admin';

export interface SpawnOptions {
  /** Working directory */
  cwd: string;
  /** Environment variables */
  env: Record<string, string>;
  /** Callback for stdout/stderr */
  onOutput?: LogStreamCallback;
}

/**
 * Spawn a command and return the process.
 */
export function spawnCommand(command: string, args: string[], options: SpawnOptions): ChildProcess {
  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Stream stdout
  if (proc.stdout && options.onOutput) {
    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        options.onOutput!(line);
      }
    });
  }

  // Stream stderr
  if (proc.stderr && options.onOutput) {
    proc.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        options.onOutput!(`[stderr] ${line}`);
      }
    });
  }

  return proc;
}

/**
 * Run a command and wait for completion.
 */
export async function runCommand(
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<{ exitCode: number; output: string[] }> {
  return new Promise((resolve, reject) => {
    const output: string[] = [];

    const proc = spawnCommand(command, args, {
      ...options,
      onOutput: (line: string) => {
        output.push(line);
        options.onOutput?.(line);
      },
    });

    proc.on('close', code => {
      resolve({ exitCode: code ?? 0, output });
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}
