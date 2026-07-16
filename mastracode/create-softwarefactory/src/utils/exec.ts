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
    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`${command} ${args.join(' ')} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    }
    child.on('error', err => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
    child.on('close', code => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

