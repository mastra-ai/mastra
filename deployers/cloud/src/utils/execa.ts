import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import { execa } from 'execa';
import { PROJECT_ENV_VARS, PROJECT_ROOT } from './constants.js';
import { logger } from './logger.js';

export const createPinoStream = () => {
  return new Writable({
    write(chunk, _encoding, callback) {
      // Convert Buffer/string to string and trim whitespace
      const line = chunk.toString().trim();

      if (line) {
        // Log each line through Pino
        logger.info(line);
      }

      callback();
    },
  });
};

export async function runWithExeca({
  cmd,
  args,
  cwd = process.cwd(),
  env = PROJECT_ENV_VARS,
}: {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}): Promise<{ stdout?: string; stderr?: string; success: boolean; error?: Error }> {
  const pinoStream = createPinoStream();

  try {
    const subprocess = execa(cmd, args, {
      cwd,
      stdin: 'ignore',
      env: {
        ...process.env,
        ...env,
      },
    });

    // Pipe stdout and stderr through the logging stream.
    // { end: false } prevents the first stream to close from ending pinoStream
    // while the other may still be writing.
    subprocess.stdout?.pipe(pinoStream, { end: false });
    subprocess.stderr?.pipe(pinoStream, { end: false });

    const { stdout, stderr, exitCode } = await subprocess;
    pinoStream.end();
    return { stdout, stderr, success: exitCode === 0 };
  } catch (error) {
    pinoStream.end();
    logger.error('Process failed', { error });
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export function runWithChildProcess(cmd: string, args: string[]): { stdout?: string; stderr?: string } {
  const pinoStream = createPinoStream();

  try {
    const __require = typeof require === 'function' ? require : createRequire(import.meta.url);
    const { stdout, stderr } = __require('node:child_process').spawnSync(cmd, args, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      shell: true,
      env: {
        ...process.env,
        ...PROJECT_ENV_VARS,
      },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    if (stdout) {
      pinoStream.write(stdout);
    }
    if (stderr) {
      pinoStream.write(stderr);
    }

    pinoStream.end();
    return { stdout, stderr };
  } catch (error) {
    logger.error('Process failed' + error);
    pinoStream.end();
    return {};
  }
}
