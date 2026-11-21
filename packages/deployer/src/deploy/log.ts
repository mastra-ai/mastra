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
 * Windows needs a shell to run package manager `.cmd` shims, and cmd.exe joins
 * every token into one command line. Plain tokens pass through as-is; anything
 * else (spaces, apostrophes, emoji, `&`, `^`…) is wrapped in double quotes, where
 * cmd.exe treats it literally. Characters cmd.exe still interprets inside quotes
 * (`"`, `!`, line breaks) are refused; `"` can never appear in a Windows path.
 * A quoted argument that ends in a backslash would make the C runtime treat that
 * backslash as escaping the closing quote, so trailing backslashes are doubled.
 * `%` only expands as a `%name%` pair, so one `%` per command line is allowed
 * (Yarn Berry's `--out …%v.tgz` needs it) and a second one is refused.
 */
const PLAIN_WINDOWS_ARG = /^[\p{L}\p{M}\p{N}_@+=:,./\\~-]+$/u;
const UNQUOTABLE_WINDOWS_ARG = /["!\r\n\0]/;

export function toWindowsShellArg(arg: string) {
  if (UNQUOTABLE_WINDOWS_ARG.test(arg)) {
    throw new Error(`Refusing to pass unsafe argument to shell command: ${JSON.stringify(arg)}`);
  }
  if (PLAIN_WINDOWS_ARG.test(arg)) return arg;
  // Double trailing backslashes so they do not escape the closing quote.
  // A loop, not /\\+$/: that pattern retries across a long non-trailing run.
  let end = arg.length;
  while (end > 0 && arg[end - 1] === '\\') end--;
  return `"${arg}${arg.slice(end)}"`;
}

export function toWindowsShellArgs(bin: string, args: string[]) {
  if (!PLAIN_WINDOWS_ARG.test(bin)) {
    throw new Error(`Refusing to spawn unsafe command: ${JSON.stringify(bin)}`);
  }
  const quoted = args.map(toWindowsShellArg);
  if ([bin, ...quoted].join(' ').split('%').length > 2) {
    throw new Error('Refusing to pass more than one "%" to a shell command');
  }
  return quoted;
}

export function createChildProcessLogger({
  logger,
  root,
  platform = process.platform,
  windowsShell,
}: {
  logger: IMastraLogger;
  root: string;
  /** Override for tests that replay the Windows `.cmd` path on another OS. */
  platform?: NodeJS.Platform;
  /** cmd.exe stand-in. Production uses `ComSpec` or `cmd.exe`. */
  windowsShell?: string;
}) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    try {
      const [bin, ...cmdArgs] = cmd.split(' ').filter(Boolean);
      if (!bin) throw new Error('Refusing to spawn an empty command');
      const allArgs = [...cmdArgs, ...args.filter(Boolean)];
      // Same shape Node uses for `shell: true` on win32: cmd.exe /d /s /c "<line>".
      // Explicit so a test can supply a cmd stand-in and still run this path.
      const subprocess =
        platform === 'win32'
          ? spawn(
              windowsShell ?? process.env.ComSpec ?? 'cmd.exe',
              ['/d', '/s', '/c', `"${[bin, ...toWindowsShellArgs(bin, allArgs)].join(' ')}"`],
              {
                cwd: root,
                env,
                windowsVerbatimArguments: true,
                stdio: ['ignore', 'pipe', 'pipe'],
              },
            )
          : spawn(bin, allArgs, {
              cwd: root,
              shell: false,
              env,
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
