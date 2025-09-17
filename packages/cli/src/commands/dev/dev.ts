import type { ChildProcess } from 'child_process';
import process from 'node:process';
import { join } from 'path';
import devcert from '@expo/devcert';
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

interface HTTPSOptions {
  key: Buffer;
  cert: Buffer;
}

interface StartOptions {
  inspect?: boolean;
  inspectBrk?: boolean;
  customArgs?: string[];
  https?: HTTPSOptions;
}

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
  startOptions: StartOptions = {},
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
        ...(startOptions?.https
          ? {
              MASTRA_HTTPS_KEY: startOptions.https.key.toString('base64'),
              MASTRA_HTTPS_CERT: startOptions.https.cert.toString('base64'),
            }
          : {}),
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
        devLogger.ready(host, port, serverStartTime, startOptions.https);
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

async function checkAndRestart(
  dotMastraPath: string,
  {
    port,
    host,
  }: {
    port: number;
    host: string;
  },
  bundler: DevBundler,
  startOptions: StartOptions = {},
) {
  if (isRestarting) {
    return;
  }

  try {
    // Check if hot reload is disabled due to template installation
    const response = await fetch(`http://${host}:${port}/__hot-reload-status`);
    if (response.ok) {
      const status = (await response.json()) as { disabled: boolean; timestamp: string };
      if (status.disabled) {
        devLogger.info('[Mastra Dev] - ⏸️  Server restart skipped: agent builder action in progress');
        return;
      }
    }
  } catch (error) {
    // If we can't check status (server down), proceed with restart
    devLogger.debug(`[Mastra Dev] - Could not check hot reload status: ${error}`);
  }

  // Proceed with restart
  devLogger.info('[Mastra Dev] - ✅ Restarting server...');
  await rebundleAndRestart(dotMastraPath, { port, host }, bundler, startOptions);
}

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
  startOptions: StartOptions = {},
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
  https,
}: {
  dir?: string;
  root?: string;
  port: number | null;
  tools?: string[];
  env?: string;
  inspect?: boolean;
  inspectBrk?: boolean;
  customArgs?: string[];
  https?: boolean;
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
  // We pass an array to tinyglobby to allow for the aforementioned negations
  const defaultTools = [defaultToolsPath, ...defaultToolsIgnorePaths];
  const discoveredTools = [defaultTools, ...(tools ?? [])];

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

  let httpsOptions: HTTPSOptions | undefined = undefined;

  /**
   * A user can enable HTTPS in two ways:
   * 1. By passing the --https flag to the dev command (we then generate a cert for them)
   * 2. By specifying https options in the mastra server config
   *
   * If both are specified, the config options takes precedence.
   */
  if (https && serverOptions?.https) {
    devLogger.warn('--https flag and server.https config are both specified. Using server.https config.');
  }
  if (serverOptions?.https) {
    httpsOptions = serverOptions.https;
  } else if (https) {
    const { key, cert } = await devcert.certificateFor(serverOptions?.host ?? 'localhost');
    httpsOptions = { key, cert };
  }

  const startOptions: StartOptions = { inspect, inspectBrk, customArgs, https: httpsOptions };

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
      devLogger.info('[Mastra Dev] - Bundling finished, checking if restart is allowed...');
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      checkAndRestart(
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
