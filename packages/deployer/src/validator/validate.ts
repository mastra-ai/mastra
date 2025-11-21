import { spawn as nodeSpawn } from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';
import { dirname } from 'node:path';
import { slash } from '../build/utils';

type ValidationArgs = {
  message: string;
  type: string;
  stack: string;
  info: Record<string, unknown>;
};

export class ValidationError extends Error {
  public readonly type: string;
  public readonly stack: string;
  public readonly info: Record<string, unknown>;
  constructor(args: ValidationArgs) {
    super(args.message);
    this.type = args.type;
    this.stack = args.stack;
    this.info = args.info;
  }
}

/**
 * Promisified version of Node.js spawn function
 *
 * @param command - The command to run
 * @param args - List of string arguments
 * @param options - Spawn options
 * @returns Promise that resolves with the exit code when the process completes
 */
function spawn(command: string, args: string[] = [], options: SpawnOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    let validationError: ValidationArgs | null = null;
    const childProcess = nodeSpawn(command, args, {
      // stdio: 'inherit',
      ...options,
    });

    childProcess.on('error', error => {
      reject(error);
    });

    let stderr = '';
    childProcess.stderr?.on('data', message => {
      try {
        validationError = JSON.parse(message.toString());
      } catch {
        stderr += message;
      }
    });

    childProcess.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        if (validationError) {
          reject(new ValidationError(validationError));
        } else {
          reject(new Error(stderr));
        }
      }
    });
  });
}

export function validate(file: string, injectESMShim = false) {
  let prefixCode = '';
  if (injectESMShim) {
    prefixCode = `import { fileURLToPath } from 'url';
import { dirname } from 'path';

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(__filename);
    `;
  }

  // Used to log a proper error we can parse instead of trying to do some fancy string grepping
  function errorHandler(err: Error, file: string) {
    if (err.stack?.includes?.('[ERR_MODULE_NOT_FOUND]')) {
      const moduleName = err.message.match(/Cannot find package '([^']+)'/)?.[1];
      console.error(
        JSON.stringify({
          type: 'ModuleNotFoundError',
          message: err.message,
          info: {
            moduleName,
            sourceFile: file,
          },
          stack: err.stack,
        }),
      );
    } else {
      console.error(
        JSON.stringify({
          type: err.name,
          message: err.message,
          stack: err.stack,
        }),
      );
    }
    process.exit(1);
  }

  return spawn(
    'node',
    [
      '--import',
      import.meta.resolve('@mastra/deployer/loader'),
      '--input-type=module',
      '-e',
      `${prefixCode};import('file://${slash(file)}').catch(err => {
        ${errorHandler.toString()}
        errorHandler(err, "${file}");
      })`.replaceAll(/\n/g, ''),
    ],
    {
      cwd: dirname(file),
    },
  );
}
