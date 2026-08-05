import { spawn } from 'node:child_process';

export interface CommandResult {
  command: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; stdin?: string } = { cwd: process.cwd() },
): Promise<CommandResult> {
  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    detached: process.platform !== 'win32',
    stdio: 'pipe',
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
  child.stdin.end(options.stdin);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    killProcessGroup(child.pid);
  }, options.timeoutMs ?? 90_000);
  timeout.unref();

  const { exitCode, signal } = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
    resolve => {
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
    },
  );
  clearTimeout(timeout);

  return {
    command: [command, ...args],
    cwd: options.cwd,
    exitCode,
    signal,
    stdout,
    stderr,
    durationMs: Date.now() - startedAt,
    timedOut,
  };
}

export function killProcessGroup(pid: number | undefined, signal: NodeJS.Signals = 'SIGTERM') {
  if (!pid) return;
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
