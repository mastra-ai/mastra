import { spawn as nodeSpawn } from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';

/**
 * Promisified version of Node.js spawn function
 *
 * @param command - The command to run
 * @param args - List of string arguments
 * @param options - Spawn options
 * @returns Promise that resolves with the exit code when the process completes
 */
function spawn(command: string, args: string[] = [], options: SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const childProcess = nodeSpawn(command, args, {
      // stdio: 'inherit',
      ...options,
    });

    childProcess.on('error', error => {
      reject(error);
    });

    childProcess.on('close', code => {
      if (code === null) {
        reject(new Error(`Command ${command} exited with null code`));
      } else {
        resolve(code);
      }
    });
  });
}

export function validate(file: string) {
  return spawn('node', [
    '--import',
    import.meta.resolve('@mastra/deployer/loader'),
    '--input-type=module',
    '-e',
    `import('file://${file.replaceAll('\\', '/')}')`,
  ]);
}
