import { Logger } from '@mastra/core';
import { execa } from 'execa';
import { Transform } from 'stream';

export const createPinoStream = (logger: Logger) => {
  return new Transform({
    transform(chunk, _encoding, callback) {
      // Convert Buffer/string to string and trim whitespace
      const line = chunk.toString().trim();

      if (line) {
        console.log(line);
        // Log each line through Pino
        logger.info(line);
      }

      // Pass through the original data
      callback(null, chunk);
    },
  });
};

export function createExecaLogger({ logger, root }: { logger: Logger; root: string }) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    const subprocess = execa(cmd, args, {
      cwd: root,
      env,
      shell: true,
    });

    // Pipe stdout and stderr through the Pino stream
    subprocess.stdout?.pipe(pinoStream);
    subprocess.stderr?.pipe(pinoStream);

    return await subprocess;
  };
}

export function createChildProcessLogger({ logger, root }: { logger: Logger; root: string }) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    try {
      const subprocess = require('child_process').spawnSync(cmd, args, {
        cwd: root,
        encoding: 'utf8',
        shell: true,
        env,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      // Pipe stdout and stderr through the Pino stream
      if (subprocess.stdout) {
        pinoStream.write(subprocess.stdout);
      }

      if (subprocess.stderr) {
        pinoStream.write(subprocess.stderr);
      }

      pinoStream.end();

      return { stdout: subprocess.stdout, stderr: subprocess.stderr };
    } catch (error) {
      logger.error('Process failed', { error });
      pinoStream.end();
      return {};
    }
  };
}
