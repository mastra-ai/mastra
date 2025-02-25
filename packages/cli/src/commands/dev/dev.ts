import type { ChildProcess } from 'child_process';
import { join } from 'path';
import { FileService } from '@mastra/deployer';
import { execa } from 'execa';

import { logger } from '../../utils/logger.js';

import { DevBundler } from './DevBundler';

let currentServerProcess: ChildProcess | undefined;
let isRestarting = false;

const startServer = async (dotMastraPath: string, port: number, env: Map<string, string>) => {
  try {
    // Restart server
    logger.info('[Mastra Dev] - Starting server...');

    const instrumentation = import.meta.resolve('@opentelemetry/instrumentation/hook.mjs');
    currentServerProcess = execa(
      'node',
      ['--import=./instrumentation.mjs', `--import=${instrumentation}`, 'index.mjs'],
      {
        cwd: dotMastraPath,
        env: {
          PORT: port.toString() || '4111',
          ...Object.fromEntries(env),
          MASTRA_DEFAULT_STORAGE_URL: `file:${join(dotMastraPath, '..', 'mastra.db')}`,
        },
        stdio: 'inherit',
        reject: false,
      },
    ) as any as ChildProcess;

    if (currentServerProcess?.exitCode && currentServerProcess?.exitCode !== 0) {
      if (!currentServerProcess) {
        throw new Error(`Server failed to start`);
      }
      throw new Error(`Server failed to start with error: ${currentServerProcess.stderr}`);
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
      logger.error('Server failed to start with error:', { message: currentServerProcess.stderr });
      return;
    }
  } catch (err) {
    const execaError = err as { stderr?: string; stdout?: string };
    if (execaError.stderr) logger.error('Server error output:', { stderr: execaError.stderr });
    if (execaError.stdout) logger.debug('Server output:', { stdout: execaError.stdout });
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
      currentServerProcess.kill('SIGKILL');
    }

    const env = await bundler.loadEnvVars();

    await startServer(join(dotMastraPath, 'output'), port, env);
  } finally {
    isRestarting = false;
  }
}

export async function dev({ port, dir, root }: { dir?: string; root?: string; port: number }) {
  const rootDir = root || process.cwd();
  const mastraDir = join(rootDir, dir || 'src/mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  const fileService = new FileService();
  const entryFile = fileService.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

  const bundler = new DevBundler();

  const env = await bundler.loadEnvVars();

  await bundler.prepare(dotMastraPath);

  const watcher = await bundler.watch(entryFile, dotMastraPath);

  await startServer(join(dotMastraPath, 'output'), port, env);

  watcher.on('event', event => {
    if (event.code === 'BUNDLE_END') {
      logger.info('[Mastra Dev] - Bundling finished, restarting server...');
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      rebundleAndRestart(dotMastraPath, port, bundler);
    }
  });

  process.on('SIGINT', () => {
    logger.info('[Mastra Dev] - Stopping server...');
    if (currentServerProcess) {
      currentServerProcess.kill();
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    watcher.close();
    process.exit(0);
  });
}
