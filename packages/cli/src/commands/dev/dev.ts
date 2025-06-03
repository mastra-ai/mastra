import type { ChildProcess } from 'child_process';
import { join } from 'path';
import { FileService } from '@mastra/deployer';
import { getServerOptions } from '@mastra/deployer/build';
import { isWebContainer } from '@webcontainer/env';
import { execa } from 'execa';

import { logger } from '../../utils/logger.js';

import { DevBundler } from './DevBundler';

let currentServerProcess: ChildProcess | undefined;
let isRestarting = false;
let errorRestartCount = 0;
const ON_ERROR_MAX_RESTARTS = 3;

const startServer = async (dotMastraPath: string, port: number, env: Map<string, string>) => {
  try {
    // Restart server
    logger.info('[Mastra Dev] - Starting server...');

    const commands = [];

    if (!isWebContainer()) {
      const instrumentation = import.meta.resolve('@opentelemetry/instrumentation/hook.mjs');
      commands.push('--import=./instrumentation.mjs', `--import=${instrumentation}`);
    }

    commands.push('index.mjs');
    currentServerProcess = execa('node', commands, {
      cwd: dotMastraPath,
      env: {
        NODE_ENV: 'production',
        ...Object.fromEntries(env),
        MASTRA_DEV: 'true',
        PORT: port.toString() || process.env.PORT || '4111',
        MASTRA_DEFAULT_STORAGE_URL: `file:${join(dotMastraPath, '..', 'mastra.db')}`,
      },
      stdio: 'inherit',
      reject: false,
    }) as any as ChildProcess;

    // Handle server process exit
    currentServerProcess.on('close', code => {
      if (!code) {
        logger.info('Server exited, restarting...');
        setTimeout(() => {
          if (!isRestarting) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            startServer(dotMastraPath, port, env);
          }
        }, 1000);
      }
    });

    if (currentServerProcess?.exitCode && currentServerProcess?.exitCode !== 0) {
      if (!currentServerProcess) {
        throw new Error(`Server failed to start`);
      }
      throw new Error(
        `Server failed to start with error: ${currentServerProcess.stderr || currentServerProcess.stdout}`,
      );
    }

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send refresh signal
    try {
      await fetch(`http://localhost:${port}/__refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Retry after another second
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        await fetch(`http://localhost:${port}/__refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // Ignore retry errors
      }
    }

    if (currentServerProcess.exitCode !== null) {
      throw new Error(
        `Server failed to start with error: ${currentServerProcess.stderr || currentServerProcess.stdout}`,
      );
    }
  } catch (err) {
    const execaError = err as { stderr?: string; stdout?: string };
    if (execaError.stderr) logger.error('Server error output:', { stderr: execaError.stderr });
    if (execaError.stdout) logger.debug('Server output:', { stdout: execaError.stdout });

    // Attempt to restart on error after a delay
    setTimeout(() => {
      if (!isRestarting) {
        errorRestartCount++;
        if (errorRestartCount > ON_ERROR_MAX_RESTARTS) {
          logger.error(`Server failed to start after ${ON_ERROR_MAX_RESTARTS} error attempts. Giving up.`);
          process.exit(1);
        }
        logger.error(
          `Attempting to restart server after error... (Attempt ${errorRestartCount}/${ON_ERROR_MAX_RESTARTS})`,
        );
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        startServer(dotMastraPath, port, env);
      }
    }, 1000);
  }
};

async function rebundleAndRestart(dotMastraPath: string, port: number, bundler: DevBundler) {
  if (isRestarting) {
    return;
  }

  isRestarting = true;
  try {
    // If current server process is running, stop it
    if (currentServerProcess) {
      logger.debug('Stopping current server...');
      currentServerProcess.kill('SIGINT');
    }

    const env = await bundler.loadEnvVars();

    await startServer(join(dotMastraPath, 'output'), port, env);
  } finally {
    isRestarting = false;
  }
}

export async function dev({
  port,
  dir,
  root,
  tools,
}: {
  dir?: string;
  root?: string;
  port: number | null;
  tools?: string[];
}) {
  // Reset restart counter at the start of dev
  errorRestartCount = 0;

  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(process.cwd(), dir)) : join(process.cwd(), 'src', 'mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  const defaultToolsPath = join(mastraDir, 'tools/**/*');
  const discoveredTools = [defaultToolsPath, ...(tools || [])];

  const fileService = new FileService();
  const entryFile = fileService.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

  const bundler = new DevBundler();
  await bundler.prepare(dotMastraPath);

  const watcher = await bundler.watch(entryFile, dotMastraPath, discoveredTools);

  const env = await bundler.loadEnvVars();

  const serverOptions = await getServerOptions(entryFile, join(dotMastraPath, 'output'));

  const startPort = port ?? serverOptions?.port ?? 4111;
  await startServer(join(dotMastraPath, 'output'), startPort, env);

  watcher.on('event', (event: { code: string }) => {
    if (event.code === 'BUNDLE_END') {
      logger.info('[Mastra Dev] - Bundling finished, restarting server...');
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      rebundleAndRestart(dotMastraPath, startPort, bundler);
    }
  });

  process.on('SIGINT', () => {
    logger.info('[Mastra Dev] - Stopping server...');
    if (currentServerProcess) {
      currentServerProcess.kill();
    }

    watcher
      .close()
      .catch(() => {})
      .finally(() => {
        process.exit(0);
      });
  });
}
