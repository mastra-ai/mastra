import type { ChildProcess } from 'child_process';
import process from 'node:process';
import { join } from 'path';
import { FileService } from '@mastra/deployer';
import { getServerOptions } from '@mastra/deployer/build';
import { isWebContainer } from '@webcontainer/env';
import { execa } from 'execa';
import getPort from 'get-port';

import { devLogger } from '../../utils/dev-logger.js';
import { logger } from '../../utils/logger.js';

import { DevBundler } from './DevBundler';

let currentServerProcess: ChildProcess | undefined;
let isRestarting = false;
let serverStartTime: number | undefined;
const ON_ERROR_MAX_RESTARTS = 3;

const startServer = async (
  dotMastraPath: string,
  {
    port,
    host,
  }: {
    port: number;
    host: string;
  },
  env: Map<string, string>,
  startOptions: { inspect?: boolean; inspectBrk?: boolean; customArgs?: string[] } = {},
  errorRestartCount = 0,
) => {
  let serverIsReady = false;
  try {
    // Restart server
    serverStartTime = Date.now();
    devLogger.starting();

    const commands = [];

    if (startOptions.inspect) {
      commands.push('--inspect');
    }

    if (startOptions.inspectBrk) {
      commands.push('--inspect-brk'); //stops at beginning of script
    }

    if (startOptions.customArgs) {
      commands.push(...startOptions.customArgs);
    }

    if (!isWebContainer()) {
      const instrumentation = import.meta.resolve('@opentelemetry/instrumentation/hook.mjs');
      commands.push(
        `--import=${import.meta.resolve('mastra/telemetry-loader')}`,
        '--import=./instrumentation.mjs',
        `--import=${instrumentation}`,
      );
    }
    commands.push('index.mjs');

    currentServerProcess = execa(process.execPath, commands, {
      cwd: dotMastraPath,
      env: {
        NODE_ENV: 'production',
        ...Object.fromEntries(env),
        MASTRA_DEV: 'true',
        PORT: port.toString(),
        MASTRA_DEFAULT_STORAGE_URL: `file:${join(dotMastraPath, '..', 'mastra.db')}`,
      },
      stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      reject: false,
    }) as any as ChildProcess;

    if (currentServerProcess?.exitCode && currentServerProcess?.exitCode !== 0) {
      if (!currentServerProcess) {
        throw new Error(`Server failed to start`);
      }
      throw new Error(
        `Server failed to start with error: ${currentServerProcess.stderr || currentServerProcess.stdout}`,
      );
    }

    // Filter server output to remove playground message
    if (currentServerProcess.stdout) {
      currentServerProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (
          !output.includes('Playground available') &&
          !output.includes('👨‍💻') &&
          !output.includes('Mastra API running on port')
        ) {
          process.stdout.write(output);
        }
      });
    }

    if (currentServerProcess.stderr) {
      currentServerProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        if (
          !output.includes('Playground available') &&
          !output.includes('👨‍💻') &&
          !output.includes('Mastra API running on port')
        ) {
          process.stderr.write(output);
        }
      });
    }

    currentServerProcess.on('message', async (message: any) => {
      if (message?.type === 'server-ready') {
        serverIsReady = true;
        devLogger.ready(host, port, serverStartTime);
        devLogger.watching();

        // Send refresh signal
        try {
          await fetch(`http://${host}:${port}/__refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch {
          // Retry after another second
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            await fetch(`http://${host}:${port}/__refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
          } catch {
            // Ignore retry errors
          }
        }
      }
    });
  } catch (err) {
    const execaError = err as { stderr?: string; stdout?: string };
    if (execaError.stderr) {
      devLogger.serverError(execaError.stderr);
      devLogger.debug(`Server error output: ${execaError.stderr}`);
    }
    if (execaError.stdout) devLogger.debug(`Server output: ${execaError.stdout}`);

    if (!serverIsReady) {
      throw err;
    }

    // Attempt to restart on error after a delay
    setTimeout(() => {
      if (!isRestarting) {
        errorRestartCount++;
        if (errorRestartCount > ON_ERROR_MAX_RESTARTS) {
          devLogger.error(`Server failed to start after ${ON_ERROR_MAX_RESTARTS} error attempts. Giving up.`);
          process.exit(1);
        }
        devLogger.warn(
          `Attempting to restart server after error... (Attempt ${errorRestartCount}/${ON_ERROR_MAX_RESTARTS})`,
        );
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        startServer(
          dotMastraPath,
          {
            port,
            host,
          },
          env,
          startOptions,
          errorRestartCount,
        );
      }
    }, 1000);
  }
};

async function rebundleAndRestart(
  dotMastraPath: string,
  {
    port,
    host,
  }: {
    port: number;
    host: string;
  },
  bundler: DevBundler,
  startOptions: { inspect?: boolean; inspectBrk?: boolean; customArgs?: string[] } = {},
) {
  if (isRestarting) {
    return;
  }

  isRestarting = true;
  try {
    // If current server process is running, stop it
    if (currentServerProcess) {
      devLogger.restarting();
      devLogger.debug('Stopping current server...');
      currentServerProcess.kill('SIGINT');
    }

    const env = await bundler.loadEnvVars();

    // spread env into process.env
    for (const [key, value] of env.entries()) {
      process.env[key] = value;
    }

    await startServer(
      join(dotMastraPath, 'output'),
      {
        port,
        host,
      },
      env,
      startOptions,
    );
  } finally {
    isRestarting = false;
  }
}

export async function dev({
  port,
  dir,
  root,
  tools,
  env,
  inspect,
  inspectBrk,
  customArgs,
}: {
  dir?: string;
  root?: string;
  port: number | null;
  tools?: string[];
  env?: string;
  inspect?: boolean;
  inspectBrk?: boolean;
  customArgs?: string[];
}) {
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(process.cwd(), dir)) : join(process.cwd(), 'src', 'mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  // You cannot express an "include all js/ts except these" in one single string glob pattern so by default an array is passed to negate test files.
  const defaultToolsPath = join(mastraDir, 'tools/**/*.{js,ts}');
  const defaultToolsIgnorePaths = [
    `!${join(mastraDir, 'tools/**/*.{test,spec}.{js,ts}')}`,
    `!${join(mastraDir, 'tools/**/__tests__/**')}`,
  ];
  // We pass an array to globby to allow for the aforementioned negations
  const defaultTools = [defaultToolsPath, ...defaultToolsIgnorePaths];
  const discoveredTools = [defaultTools, ...(tools ?? [])];
  const startOptions = { inspect, inspectBrk, customArgs };

  const fileService = new FileService();
  const entryFile = fileService.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

  const bundler = new DevBundler(env);
  bundler.__setLogger(logger); // Keep Pino logger for internal bundler operations

  const loadedEnv = await bundler.loadEnvVars();

  // spread loadedEnv into process.env
  for (const [key, value] of loadedEnv.entries()) {
    process.env[key] = value;
  }

  const serverOptions = await getServerOptions(entryFile, join(dotMastraPath, 'output'));
  let portToUse = port ?? serverOptions?.port ?? process.env.PORT;
  let hostToUse = serverOptions?.host ?? process.env.HOST ?? 'localhost';
  if (!portToUse || isNaN(Number(portToUse))) {
    const portList = Array.from({ length: 21 }, (_, i) => 4111 + i);
    portToUse = String(
      await getPort({
        port: portList,
      }),
    );
  }

  await bundler.prepare(dotMastraPath);

  const watcher = await bundler.watch(entryFile, dotMastraPath, discoveredTools);

  await startServer(
    join(dotMastraPath, 'output'),
    {
      port: Number(portToUse),
      host: hostToUse,
    },
    loadedEnv,
    startOptions,
  );

  watcher.on('event', (event: { code: string }) => {
    if (event.code === 'BUNDLE_START') {
      devLogger.bundling();
    }
    if (event.code === 'BUNDLE_END') {
      devLogger.bundleComplete();
      devLogger.info('Bundling finished, restarting server...');
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      rebundleAndRestart(
        dotMastraPath,
        {
          port: Number(portToUse),
          host: hostToUse,
        },
        bundler,
        startOptions,
      );
    }
  });

  process.on('SIGINT', () => {
    devLogger.shutdown();

    if (currentServerProcess) {
      currentServerProcess.kill();
    }

    watcher
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
}
