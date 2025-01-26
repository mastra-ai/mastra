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

// export function runWithChildProcess(
//     cmd: string,
//     args: string[]
// ): { stdout?: string; stderr?: string } {
//     const pinoStream = createPinoStream()

//     try {
//         const { stdout, stderr } = require('child_process').spawnSync(cmd, args, {
//             cwd: PROJECT_ROOT,
//             encoding: 'utf8',
//             shell: true,
//             maxBuffer: 1024 * 1024 * 10, // 10MB buffer
//         })

//         if (stdout) {
//             pinoStream.write(stdout)
//         }
//         if (stderr) {
//             pinoStream.write(stderr)
//         }

//         pinoStream.end()
//         return { stdout, stderr }
//     } catch (error) {
//         logger.error(error, 'Process failed')
//         pinoStream.end()
//         return {}
//     }
// }
