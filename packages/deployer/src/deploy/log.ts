import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import type { IMastraLogger } from '@mastra/core/logger';

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
 * Args are joined into a shell command (`shell: true` is required for package
 * manager shims on Windows), so only allow characters that appear in package
 * specifiers and CLI flags — never shell metacharacters (CodeQL
 * js/shell-command-constructed-from-input).
 */
const SAFE_SHELL_ARG = /^[\w@%+=:,./^~-]*$/;

export function createChildProcessLogger({ logger, root }: { logger: IMastraLogger; root: string }) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    try {
      for (const arg of args) {
        if (!SAFE_SHELL_ARG.test(arg)) {
          throw new Error(`Refusing to pass unsafe argument to shell command: ${JSON.stringify(arg)}`);
        }
      }
      const subprocess = spawn(cmd, args, {
        cwd: root,
        shell: true,
        env,
        // No stdin for the child process — it doesn't need interactive input
        stdio: ['ignore', 'pipe', 'pipe'],
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
            resolve({ success: true });
          } else {
            reject(new Error(`Process exited with code ${code}`));
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
