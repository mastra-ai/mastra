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

  let timedOut = false;
  let forceKillTimeout: NodeJS.Timeout | undefined;
  const timeout = setTimeout(() => {
    timedOut = true;
    killProcessGroup(child.pid);
    forceKillTimeout = setTimeout(() => killProcessGroup(child.pid, 'SIGKILL'), 5_000);
    forceKillTimeout.unref();
  }, options.timeoutMs ?? 90_000);
  timeout.unref();

  const completion = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    const rejectAndTerminate = (error: Error) =>
      settle(() => {
        if (child.exitCode === null && child.signalCode === null) {
          killProcessGroup(child.pid, 'SIGKILL');
        }
        reject(error);
      });

    child.once('error', rejectAndTerminate);
    child.stdin.once('error', rejectAndTerminate);
    child.stdout.once('error', rejectAndTerminate);
    child.stderr.once('error', rejectAndTerminate);
    child.once('close', (exitCode, signal) => settle(() => resolve({ exitCode, signal })));
  });

  child.stdin.end(options.stdin);
  const { exitCode, signal } = await completion.finally(() => {
    clearTimeout(timeout);
    if (forceKillTimeout) clearTimeout(forceKillTimeout);
  });

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
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return;
    if (code === 'EPERM' && process.platform !== 'win32') {
      try {
        process.kill(pid, signal);
        return;
      } catch (fallbackError) {
        if ((fallbackError as NodeJS.ErrnoException).code === 'ESRCH') return;
        throw fallbackError;
      }
    }
    throw error;
  }
}
