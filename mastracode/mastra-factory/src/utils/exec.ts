import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

/** Run a command with inherited stdio (used for package installs). */
export function runInherit(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    let timeout: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let timedOut = false;
    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        // Don't reject yet — wait for `close` so the caller never proceeds
        // while the child is still running. Escalate if SIGTERM is ignored.
        timedOut = true;
        if (process.platform === 'win32' && child.pid) {
          // `shell: true` means child.kill() would only hit the cmd.exe
          // wrapper — taskkill /T terminates the whole process tree.
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          // If taskkill can't run or fails, fall back to killing the wrapper
          // so the `close` handler still fires and the promise settles.
          killer.on('error', () => child.kill());
          killer.on('exit', code => {
            if (code !== 0) child.kill();
          });
        } else {
          child.kill('SIGTERM');
          killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000);
        }
      }, options.timeoutMs);
    }
    const clearTimers = () => {
      if (timeout) clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
    };
    child.on('error', err => {
      clearTimers();
      reject(err);
    });
    child.on('close', code => {
      clearTimers();
      if (timedOut) reject(new Error(`${command} ${args.join(' ')} timed out after ${options.timeoutMs}ms`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
