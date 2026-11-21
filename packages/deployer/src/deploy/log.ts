import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
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
 * Package-manager shims on Windows are `.cmd` files. Node cannot spawn those
 * without a shell, so read the shim and run the Node script it points at.
 * `%~dp0` / `%dp0%` are the shim's directory.
 */
function normalizeWinPath(value: string): string {
  const drive = value.match(/[A-Za-z]:\\.*/);
  if (!drive?.[0]) return value.trim();
  return drive[0].replace(/\\{2,}/g, '\\');
}

export function windowsShimTarget(
  cmdText: string,
  cmdDir: string,
): { nodePath: string | undefined; scriptPath: string } | undefined {
  const prefix = cmdDir.replace(/[\\/]+$/, '') + '\\';
  const expanded = cmdText.replace(/%~dp0|%dp0%/gi, () => prefix);
  const quoted = [...expanded.matchAll(/"([^"\r\n]+)"/g)].map(match => normalizeWinPath(match[1] ?? ''));
  const scriptPath = quoted.filter(value => /\.(?:js|cjs|mjs)$/i.test(value)).at(-1);
  if (!scriptPath) return undefined;
  const nodePath = quoted.filter(value => /\\node\.exe$/i.test(value)).at(-1);
  return { nodePath, scriptPath };
}

/** Executable plus any leading arguments, with no shell involved. */
export function resolveSpawnTarget(
  command: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): { file: string; args: string[] } {
  if (platform !== 'win32') return { file: command, args: [] };

  const resolved = resolveWindowsCommand(command, env);
  if (!resolved) return { file: command, args: [] };
  const extension = path.win32.extname(resolved).toLowerCase();
  if (extension !== '.cmd' && extension !== '.bat') return { file: resolved, args: [] };

  let cmdText: string;
  try {
    cmdText = readFileSync(resolved, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read package manager shim ${resolved}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const target = windowsShimTarget(cmdText, path.win32.dirname(resolved));
  if (!target || !existsSync(target.scriptPath)) {
    throw new Error(`Could not find a Node entry point in package manager shim ${resolved}`);
  }
  const nodePath = target.nodePath && existsSync(target.nodePath) ? target.nodePath : process.execPath;
  return { file: nodePath, args: [target.scriptPath] };
}

function resolveWindowsCommand(command: string, env: NodeJS.ProcessEnv): string | undefined {
  if (path.win32.isAbsolute(command) || command.includes('\\') || command.includes('/')) return command;
  const pathValue = env.PATH ?? env.Path ?? '';
  const extensions = (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map(extension => extension.trim())
    .filter(extension => extension.length > 0);
  const suffixes = path.win32.extname(command) ? [''] : ['', ...extensions];
  for (const directory of pathValue.split(';')) {
    if (!directory) continue;
    for (const suffix of suffixes) {
      const candidate = path.win32.join(directory, suffix ? command + suffix : command);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export function createChildProcessLogger({ logger, root }: { logger: IMastraLogger; root: string }) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    try {
      const target = resolveSpawnTarget(cmd, env);
      // Argument vector, never a shell string. Windows `.cmd` shims are rewritten
      // to their Node entry point above so package managers still launch there.
      const subprocess = spawn(target.file, [...target.args, ...args], {
        cwd: root,
        shell: false,
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
