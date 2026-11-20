import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import type { IMastraLogger } from '@internal/core/logger';

export const createPinoStream = (logger: IMastraLogger) => {
  return new Writable({
    write(chunk, _encoding, callback) {
      // Convert Buffer/string to string and trim whitespace
      const line = chunk.toString().trim();

      if (line) {
        console.info(line);
        // Log each line through Pino
        logger.info(line);
      }

      callback();
    },
  });
};

/**
 * Windows needs a shell to run package manager `.cmd` shims, and the shell joins
 * every token into one command line. There, only allow characters that appear in
 * package specifiers, paths (including non-ASCII letters) and CLI flags — never
 * shell metacharacters.
 */
const SAFE_SHELL_ARG = /^[\p{L}\p{M}\p{N}_@%+=:,./\\^~-]*$/u;

export function isSafeShellArg(arg: string) {
  return SAFE_SHELL_ARG.test(arg);
}

export function createChildProcessLogger({ logger, root }: { logger: IMastraLogger; root: string }) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    try {
      const [bin, ...cmdArgs] = cmd.split(' ').filter(Boolean);
      if (!bin) throw new Error('Refusing to spawn an empty command');
      const allArgs = [...cmdArgs, ...args.filter(Boolean)];
      const shell = process.platform === 'win32';
      if (shell) {
        for (const arg of [bin, ...allArgs]) {
          if (!isSafeShellArg(arg)) {
            throw new Error(`Refusing to pass unsafe argument to shell command: ${JSON.stringify(arg)}`);
          }
        }
      }
      const subprocess = spawn(bin, allArgs, {
        cwd: root,
        shell,
        env,
        // No stdin for the child process — it doesn't need interactive input
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      subprocess.stdout?.on('data', chunk => {
        stdout += chunk.toString();
      });
      subprocess.stderr?.on('data', chunk => {
        stderr += chunk.toString();
      });

      // Pipe stdout and stderr through the logging stream.
      // { end: false } prevents the first stream to close from ending pinoStream
      // while the other may still be writing.
      subprocess.stdout?.pipe(pinoStream, { end: false });
      subprocess.stderr?.pipe(pinoStream, { end: false });

      // Wait for the process to complete
      return new Promise((resolve, reject) => {
        subprocess.on('close', code => {
          pinoStream.end();
          if (code === 0) {
            resolve({ success: true, stdout, stderr });
          } else {
            reject(Object.assign(new Error(`Process exited with code ${code}`), { stdout, stderr }));
          }
        });

        subprocess.on('error', error => {
          pinoStream.end();
          logger.error('Process failed', { error });
          reject(error);
        });
      });
    } catch (error) {
      console.error(error);
      logger.error('Process failed', { error });
      pinoStream.end();
      return { success: false, error };
    }
  };
}
