import type { ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import devcert from '@expo/devcert';
import { FileService } from '@mastra/deployer';
import { getServerOptions, normalizeStudioBase } from '@mastra/deployer/build';
import { execa } from 'execa';
import getPort from 'get-port';

import { devLogger } from '../../utils/dev-logger.js';
import { createLogger } from '../../utils/logger.js';
import type { MastraPackageInfo } from '../../utils/mastra-packages.js';
import { getMastraPackages } from '../../utils/mastra-packages.js';

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
  inspect?: string | boolean;
  inspectBrk?: string | boolean;
  customArgs?: string[];
  https?: HTTPSOptions;
  mastraPackages?: MastraPackageInfo[];
}

type ProcessOptions = {
  port: number;
  host: string;
  studioBasePath: string;
  publicDir: string;
};

const restartAllActiveWorkflowRuns = async ({ host, port }: { host: string; port: number }) => {
  try {
    await fetch(`http://${host}:${port}/__restart-active-workflow-runs`, {
      method: 'POST',
    });
  } catch (error) {
    devLogger.error(`Failed to restart all active workflow runs: ${error}`);
    // Retry after another second
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      await fetch(`http://${host}:${port}/__restart-active-workflow-runs`, {
        method: 'POST',
      });
    } catch {
      // Ignore retry errors
    }
  }
};

const startServer = async (
  dotMastraPath: string,
  { port, host, studioBasePath, publicDir }: ProcessOptions,
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

    const inspect = startOptions.inspect === '' ? true : startOptions.inspect;
    const inspectBrk = startOptions.inspectBrk === '' ? true : startOptions.inspectBrk;

    if (inspect) {
      const inspectFlag = typeof inspect === 'string' ? `--inspect=${inspect}` : '--inspect';
      commands.push(inspectFlag);
    }

    if (inspectBrk) {
      const inspectBrkFlag = typeof inspectBrk === 'string' ? `--inspect-brk=${inspectBrk}` : '--inspect-brk';
      commands.push(inspectBrkFlag);
    }

    if (startOptions.customArgs) {
      commands.push(...startOptions.customArgs);
    }

    commands.push(join(dotMastraPath, 'index.mjs'));

    // Write mastra packages to a file and pass the file path via env var
    const packagesFilePath = join(dotMastraPath, '..', 'mastra-packages.json');
    if (startOptions.mastraPackages) {
      await writeFile(packagesFilePath, JSON.stringify(startOptions.mastraPackages), 'utf-8');
    }

    await mkdir(publicDir, { recursive: true });
    currentServerProcess = execa(process.execPath, commands, {
      cwd: publicDir,
      env: {
        NODE_ENV: 'production',
        ...Object.fromEntries(env),
        MASTRA_DEV: 'true',
        PORT: port.toString(),
        MASTRA_PACKAGES_FILE: packagesFilePath,
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
          !output.includes('Studio available') &&
          !output.includes('👨‍💻') &&
          !output.includes('Mastra API running on ')
        ) {
          process.stdout.write(output);
        }
      });
    }

    if (currentServerProcess.stderr) {
      currentServerProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        if (
          !output.includes('Studio available') &&
          !output.includes('👨‍💻') &&
          !output.includes('Mastra API running on ')
        ) {
          process.stderr.write(output);
        }
      });
    }

    // Handle IPC errors to prevent EPIPE crashes
    currentServerProcess.on('error', (err: Error) => {
      if ((err as any).code !== 'EPIPE') {
        throw err;
      }
    });

    currentServerProcess.on('message', async (message: any) => {
      if (message?.type === 'server-ready') {
        serverIsReady = true;
        devLogger.ready(host, port, studioBasePath, serverStartTime, startOptions.https);
        devLogger.watching();

        await restartAllActiveWorkflowRuns({ host, port });

        // Send refresh signal
        try {
          await fetch(`http://${host}:${port}${studioBasePath}/__refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch {
          // Retry after another second
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            await fetch(`http://${host}:${port}${studioBasePath}/__refresh`, {
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
            studioBasePath,
            publicDir,
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
  { port, host, studioBasePath, publicDir }: ProcessOptions,
  bundler: DevBundler,
  startOptions: StartOptions = {},
) {
  if (isRestarting) {
    return;
  }

  try {
    // Check if hot reload is disabled due to template installation
    const response = await fetch(`http://${host}:${port}${studioBasePath}/__hot-reload-status`);
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
  await rebundleAndRestart(dotMastraPath, { port, host, studioBasePath, publicDir }, bundler, startOptions);
}

async function rebundleAndRestart(
  dotMastraPath: string,
  { port, host, studioBasePath, publicDir }: ProcessOptions,
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
        studioBasePath,
        publicDir,
      },
      env,
      startOptions,
    );
  } finally {
    isRestarting = false;
  }
}

export async function dev({
  dir,
  root,
  tools,
  env,
  inspect,
  inspectBrk,
  customArgs,
  https,
  debug,
}: {
  dir?: string;
  root?: string;
  tools?: string[];
  env?: string;
  inspect?: string | boolean;
  inspectBrk?: string | boolean;
  customArgs?: string[];
  https?: boolean;
  debug: boolean;
}) {
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(process.cwd(), dir)) : join(process.cwd(), 'src', 'mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  const fileService = new FileService();
  const entryFile = fileService.getFirstExistingFile([join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')]);

  const bundler = new DevBundler(env);
  bundler.__setLogger(createLogger(debug)); // Keep Pino logger for internal bundler operations

  // Use the bundler's getAllToolPaths method to prepare tools paths
  const discoveredTools = bundler.getAllToolPaths(mastraDir, tools ?? []);

  const loadedEnv = await bundler.loadEnvVars();

  // spread loadedEnv into process.env
  for (const [key, value] of loadedEnv.entries()) {
    process.env[key] = value;
  }

  const serverOptions = await getServerOptions(entryFile, join(dotMastraPath, 'output'));
  let portToUse = serverOptions?.port ?? process.env.PORT;
  let hostToUse = serverOptions?.host ?? process.env.HOST ?? 'localhost';
  const studioBasePathToUse = normalizeStudioBase(serverOptions?.studioBase ?? '/');

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

  // Extract mastra packages from the project's package.json
  const mastraPackages = await getMastraPackages(rootDir);

  const startOptions: StartOptions = { inspect, inspectBrk, customArgs, https: httpsOptions, mastraPackages };

  await bundler.prepare(dotMastraPath);

  const watcher = await bundler.watch(entryFile, dotMastraPath, discoveredTools);

  await startServer(
    join(dotMastraPath, 'output'),
    {
      port: Number(portToUse),
      host: hostToUse,
      studioBasePath: studioBasePathToUse,
      publicDir: join(mastraDir, 'public'),
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
          studioBasePath: studioBasePathToUse,
          publicDir: join(mastraDir, 'public'),
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
