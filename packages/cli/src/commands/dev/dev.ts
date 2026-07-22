import type { ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import devcert from '@expo/devcert';
import {
  getServerOptions,
  normalizeStudioBase,
  prepareFsAgentsEntry,
  writeFsAgentsEntry,
  mirrorFsAgentWorkspaces,
} from '@mastra/deployer/build';
import { execa } from 'execa';
import getPort from 'get-port';
import pc from 'picocolors';
import { getAnalytics } from '../../analytics/index.js';
import { checkMastraPeerDeps, getUpdateCommand, logPeerDepWarnings } from '../../utils/check-peer-deps.js';
import type { PeerDepMismatch } from '../../utils/check-peer-deps.js';
import { devLogger } from '../../utils/dev-logger.js';
import { findMastraEntryFile } from '../../utils/find-mastra-entry.js';
import { createLogger } from '../../utils/logger.js';
import type { MastraPackageInfo } from '../../utils/mastra-packages.js';
import { getMastraPackages } from '../../utils/mastra-packages.js';
import { loadAndValidatePresets } from '../../utils/validate-presets.js';

import { acquireDevLock, releaseDevLock, updateDevLock } from './dev-lock';
import { DevBundler } from './DevBundler';

let currentServerProcess: ChildProcess | undefined;
let isRestarting = false;
let serverStartTime: number | undefined;
let requestContextPresetsJson: string | undefined;
const ON_ERROR_MAX_RESTARTS = 3;

function waitForProcessExit(child: ChildProcess, timeoutMs = 2000): Promise<void> {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      resolve();
    };
    child.once('exit', done);
    if (child.exitCode !== null) {
      child.removeListener('exit', done);
      done();
      return;
    }
    timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, timeoutMs);
  });
}

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
  peerDepMismatches?: PeerDepMismatch[];
  factory?: boolean;
}

type ProcessOptions = {
  port: number;
  host: string;
  studioBasePath: string;
  apiPrefix: string;
  publicDir: string;
};

const restartAllActiveWorkflowRuns = async ({ host, port, https }: { host: string; port: number; https?: boolean }) => {
  const scheme = https ? 'https' : 'http';
  try {
    await fetch(`${scheme}://${host}:${port}/__restart-active-workflow-runs`, {
      method: 'POST',
    });
  } catch (error) {
    devLogger.error(`Failed to restart all active workflow runs: ${error}`);
    // Retry after another second
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      await fetch(`${scheme}://${host}:${port}/__restart-active-workflow-runs`, {
        method: 'POST',
      });
    } catch {
      // Ignore retry errors
    }
  }
};

const startServer = async (
  dotMastraPath: string,
  { port, host, studioBasePath, apiPrefix, publicDir }: ProcessOptions,
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
    await mkdir(dotMastraPath, { recursive: true });
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
        MASTRA_TELEMETRY_COMMAND: startOptions.factory ? 'factory dev' : 'dev',
        MASTRA_PROJECT_ROOT: resolve(dotMastraPath, '..'),
        ...(getAnalytics()?.getDistinctId() ? { MASTRA_CLI_DISTINCT_ID: getAnalytics()!.getDistinctId() } : {}),
        ...(startOptions?.https
          ? {
              MASTRA_HTTPS_KEY: startOptions.https.key.toString('base64'),
              MASTRA_HTTPS_CERT: startOptions.https.cert.toString('base64'),
            }
          : {}),
        ...(startOptions.factory ? { MASTRA_FACTORY_DEV: 'true' } : {}),
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

    // Filter server output to remove Studio message
    if (currentServerProcess.stdout) {
      currentServerProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (!output.includes('Studio available') && !output.includes('👨‍💻') && !output.includes('Mastra API running')) {
          process.stdout.write(output);
        }
      });
    }

    if (currentServerProcess.stderr) {
      currentServerProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        if (!output.includes('Studio available') && !output.includes('👨‍💻') && !output.includes('Mastra API running')) {
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

    // Show hint about updating packages when server exits with error
    currentServerProcess.on('exit', (code: number | null) => {
      if (code !== null && code !== 0) {
        const updateCommand = getUpdateCommand(startOptions.peerDepMismatches ?? []);
        if (updateCommand) {
          console.warn();
          devLogger.warn(`This error may be caused by mismatched package versions. Try running:`);
          console.warn(`  ${pc.cyan(updateCommand)}`);
          console.warn();
        }
      }
    });

    currentServerProcess.on('message', async (message: any) => {
      if (message?.type === 'server-ready') {
        serverIsReady = true;
        devLogger.ready(host, port, studioBasePath, apiPrefix, serverStartTime, startOptions.https);
        devLogger.watching();

        await restartAllActiveWorkflowRuns({ host, port, https: !!startOptions.https });

        // Send refresh signal
        const scheme = startOptions.https ? 'https' : 'http';
        try {
          await fetch(`${scheme}://${host}:${port}${studioBasePath}/__refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch {
          // Retry after another second
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            await fetch(`${scheme}://${host}:${port}${studioBasePath}/__refresh`, {
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

    // Show hint about updating packages if there are peer dep mismatches
    const updateCommand = getUpdateCommand(startOptions.peerDepMismatches ?? []);
    if (updateCommand) {
      devLogger.warn(`This error may be caused by mismatched package versions. Try running: ${updateCommand}`);
    }

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
            apiPrefix,
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
  { port, host, studioBasePath, apiPrefix, publicDir }: ProcessOptions,
  bundler: DevBundler,
  startOptions: StartOptions = {},
) {
  if (isRestarting) {
    return;
  }

  try {
    // Check if hot reload is disabled due to template installation
    const scheme = startOptions.https ? 'https' : 'http';
    const response = await fetch(`${scheme}://${host}:${port}${studioBasePath}/__hot-reload-status`);
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
  await rebundleAndRestart(dotMastraPath, { port, host, studioBasePath, apiPrefix, publicDir }, bundler, startOptions);
}

async function rebundleAndRestart(
  dotMastraPath: string,
  { port, host, studioBasePath, apiPrefix, publicDir }: ProcessOptions,
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
      const serverProcess = currentServerProcess;
      // Wait for the process to exit before starting a new one
      await new Promise<void>(resolve => {
        if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
          resolve();
          return;
        }

        let timeout: NodeJS.Timeout | undefined;
        const handleExit = () => {
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve();
        };

        serverProcess.once('exit', handleExit);

        try {
          serverProcess.kill('SIGINT');
        } catch {
          if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
            serverProcess.off('exit', handleExit);
            resolve();
          }
          return;
        }

        timeout = setTimeout(() => {
          try {
            serverProcess.kill('SIGKILL');
          } catch {
            if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
              serverProcess.off('exit', handleExit);
              resolve();
            }
          }
        }, 5000);
      });
      if (currentServerProcess === serverProcess) {
        currentServerProcess = undefined;
      }
    }

    const env = await bundler.loadEnvVars();

    // Add request context presets to env if available
    if (requestContextPresetsJson) {
      env.set('MASTRA_REQUEST_CONTEXT_PRESETS', requestContextPresetsJson);
    }

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
        apiPrefix,
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
  requestContextPresets,
  debug,
  factory,
}: {
  dir?: string;
  root?: string;
  tools?: string[];
  env?: string;
  inspect?: string | boolean;
  inspectBrk?: string | boolean;
  customArgs?: string[];
  https?: boolean;
  requestContextPresets?: string;
  debug: boolean;
  factory?: boolean;
}) {
  const rootDir = root || process.cwd();
  const mastraDir = dir ? (dir.startsWith('/') ? dir : join(process.cwd(), dir)) : join(process.cwd(), 'src', 'mastra');
  const dotMastraPath = join(rootDir, '.mastra');

  await mkdir(dotMastraPath, { recursive: true });
  await acquireDevLock(dotMastraPath);

  // Look for the user's mastra entry file. When it doesn't exist (fully
  // file-based project), prepareFsAgentsEntry auto-constructs a Mastra instance.
  const userEntryFile = findMastraEntryFile(mastraDir);

  const bundler = new DevBundler(env, factory);
  bundler.__setLogger(createLogger(debug)); // Keep Pino logger for internal bundler operations

  // Discover fs-routed agents under agents/* and, if any exist, wrap the entry so
  // they are registered onto the user's mastra instance. Falls back to the user
  // entry unchanged when there are none.
  const fsAgents = await prepareFsAgentsEntry(mastraDir, userEntryFile, dotMastraPath);
  const entryFile = fsAgents.entryFile;

  // Use the bundler's getAllToolPaths method to prepare tools paths, plus any
  // tools defined under agents/*/tools for fs-routed agents.
  const discoveredTools = bundler.getAllToolPaths(mastraDir, [...(tools ?? []), ...fsAgents.toolPaths]);

  const loadedEnv = await bundler.loadEnvVars();

  // Clear any prior presets to avoid cross-run leakage
  requestContextPresetsJson = undefined;
  loadedEnv.delete('MASTRA_REQUEST_CONTEXT_PRESETS');
  delete process.env.MASTRA_REQUEST_CONTEXT_PRESETS;

  // spread loadedEnv into process.env
  for (const [key, value] of loadedEnv.entries()) {
    process.env[key] = value;
  }

  // Load and validate request context presets if provided
  if (requestContextPresets) {
    try {
      requestContextPresetsJson = await loadAndValidatePresets(requestContextPresets);
      // Add presets to loaded env so it's passed to the server
      loadedEnv.set('MASTRA_REQUEST_CONTEXT_PRESETS', requestContextPresetsJson);
    } catch (error) {
      devLogger.error(`Failed to load request context presets: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  const serverOptions = userEntryFile ? await getServerOptions(userEntryFile, join(dotMastraPath, 'output')) : null;
  let portToUse = serverOptions?.port ?? process.env.PORT;
  let hostToUse = serverOptions?.host ?? process.env.HOST ?? 'localhost';
  const studioBasePathToUse = normalizeStudioBase(serverOptions?.studioBase ?? '/');
  const apiPrefixToUse = serverOptions?.apiPrefix ?? '/api';

  if (!portToUse || isNaN(Number(portToUse))) {
    const portList = Array.from({ length: 21 }, (_, i) => 4111 + i);
    portToUse = String(
      await getPort({
        port: portList,
      }),
    );
  }

  await updateDevLock(dotMastraPath, hostToUse, Number(portToUse));

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

  // Check for peer dependency version mismatches
  const peerDepMismatches = await checkMastraPeerDeps(mastraPackages);
  logPeerDepWarnings(peerDepMismatches);

  const startOptions: StartOptions = {
    inspect,
    inspectBrk,
    customArgs,
    https: httpsOptions,
    mastraPackages,
    peerDepMismatches,
    factory,
  };

  await bundler.prepare(dotMastraPath);

  // Re-assert the lock after prepare() emptied the directory.
  // The bundler preserves the lock, but this ensures the data is current.
  await updateDevLock(dotMastraPath, hostToUse, Number(portToUse));

  // Write the generated fs-routed agents wrapper entry. Runs after `prepare()`
  // empties the output directory so the wrapper is not wiped before the watcher
  // reads it. No-op when there are no fs-routed agents.
  await writeFsAgentsEntry(fsAgents);

  // Mirror authored `agents/<name>/workspace/**` seeds into the bundled output
  // directory, where the generated entry resolves each agent's default
  // workspace at runtime. Runs after `prepare()` so it is not wiped.
  if (fsAgents.agentCount > 0) {
    await mirrorFsAgentWorkspaces(mastraDir, join(dotMastraPath, 'output'));
  }

  const watcher = await bundler.watch(entryFile, dotMastraPath, discoveredTools, {
    mastraDir,
    userEntryFile,
    outputDirectory: dotMastraPath,
    preparedEntry: fsAgents,
  });

  await startServer(
    join(dotMastraPath, 'output'),
    {
      port: Number(portToUse),
      host: hostToUse,
      studioBasePath: studioBasePathToUse,
      apiPrefix: apiPrefixToUse,
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
          apiPrefix: apiPrefixToUse,
          publicDir: join(mastraDir, 'public'),
        },
        bundler,
        startOptions,
      );
    }
  });

  let isShuttingDown = false;
  const handleShutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    const forceExit = setTimeout(() => process.exit(0), 3000);
    forceExit.unref();

    devLogger.shutdown();

    if (currentServerProcess) {
      currentServerProcess.kill();
      await waitForProcessExit(currentServerProcess);
      currentServerProcess = undefined;
    }

    const analytics = getAnalytics();
    if (analytics && serverStartTime) {
      const durationMs = Date.now() - serverStartTime;
      analytics.trackEvent('cli_dev_session_end', {
        durationMs,
        durationMinutes: Math.round(durationMs / 60000),
      });
    }
    if (analytics) {
      await analytics.shutdown();
    }

    watcher
      .close()
      .catch(() => {})
      .finally(() => {
        releaseDevLock(dotMastraPath);
        clearTimeout(forceExit);
        process.exit(0);
      });
  };

  const onSignal = () => {
    handleShutdown().catch(() => process.exit(0));
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  process.on('SIGHUP', onSignal);
}
