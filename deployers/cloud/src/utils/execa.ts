import { Transform } from 'stream';
import { execa } from 'execa';
import { PROJECT_ENV_VARS, PROJECT_ROOT } from './constants.js';
import { logger } from './logger.js';

export const createPinoStream = () => {
  return new Transform({
    transform(chunk, encoding, callback) {
      // Convert Buffer/string to string and trim whitespace
      const line = chunk.toString().trim();

      if (line) {
        // Log each line through Pino
        logger.info(line);
      }

      // Pass through the original data
      callback(null, chunk);
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
      env: {
        ...process.env,
        ...env,
      },
    });

    // Pipe stdout and stderr through the Pino stream
    subprocess.stdout?.pipe(pinoStream);
    subprocess.stderr?.pipe(pinoStream);

    const { stdout, stderr, exitCode } = await subprocess;
    return { stdout, stderr, success: exitCode === 0 };
  } catch (error) {
    logger.error(`Process failed: ${error}`);
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export function runWithChildProcess(cmd: string, args: string[]): { stdout?: string; stderr?: string } {
  const pinoStream = createPinoStream();

  try {
    const { stdout, stderr } = require('child_process').spawnSync(cmd, args, {
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
