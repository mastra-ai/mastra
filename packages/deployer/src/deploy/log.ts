import { spawn } from 'child_process';
import { Transform } from 'stream';
import type { Logger } from '@mastra/core/logger';

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

export function createChildProcessLogger({ logger, root }: { logger: Logger; root: string }) {
  const pinoStream = createPinoStream(logger);
  return async ({ cmd, args, env }: { cmd: string; args: string[]; env: Record<string, string> }) => {
    try {
      const subprocess = spawn(cmd, args, {
        cwd: root,
        shell: true,
        env,
      });

      // Pipe stdout and stderr through the Pino stream
      subprocess.stdout?.pipe(pinoStream);
      subprocess.stderr?.pipe(pinoStream);

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
      console.log(error);
      logger.error('Process failed', { error });
      pinoStream.end();
      return { success: false, error };
    }
  };
}
