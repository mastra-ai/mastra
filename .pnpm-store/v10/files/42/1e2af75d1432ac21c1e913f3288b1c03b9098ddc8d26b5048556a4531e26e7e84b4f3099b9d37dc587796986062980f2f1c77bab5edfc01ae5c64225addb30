import chalk from "chalk";
import { OneoffCtx } from "../../bundler/context.js";
import {
  logError,
  logFinishedStep,
  logMessage,
  logWarning,
  showSpinner,
  showSpinnerIfSlow,
  stopSpinner,
} from "../../bundler/log.js";
import { runPush } from "./components.js";
import { performance } from "perf_hooks";
import path from "path";
import { LogManager, LogMode, watchLogs } from "./logs.js";
import { PushOptions } from "./components.js";
import {
  formatDuration,
  getCurrentTimeString,
  spawnAsync,
  waitForever,
  waitUntilCalled,
} from "./utils/utils.js";
import { Crash, WatchContext, Watcher } from "./watch.js";
import { runFunctionAndLog, subscribe } from "./run.js";
import { Value } from "../../values/index.js";

export async function devAgainstDeployment(
  ctx: OneoffCtx,
  credentials: {
    url: string;
    adminKey: string;
    deploymentName: string | null;
  },
  devOptions: {
    verbose: boolean;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents: boolean;
    codegen: boolean;
    once: boolean;
    untilSuccess: boolean;
    run?:
      | { kind: "function"; name: string; component?: string | undefined }
      | { kind: "shell"; command: string }
      | undefined;
    tailLogs: LogMode;
    traceEvents: boolean;
    debugBundlePath?: string | undefined;
    debugNodeApis: boolean;
    liveComponentSources: boolean;
  },
) {
  const logManager = new LogManager(devOptions.tailLogs);

  const promises = [];
  if (devOptions.tailLogs !== "disable") {
    promises.push(
      watchLogs(ctx, credentials.url, credentials.adminKey, "stderr", {
        logManager,
        success: false,
      }),
    );
  }

  promises.push(
    watchAndPush(
      ctx,
      {
        ...credentials,
        verbose: devOptions.verbose,
        dryRun: false,
        typecheck: devOptions.typecheck,
        typecheckComponents: devOptions.typecheckComponents,
        debug: false,
        debugBundlePath: devOptions.debugBundlePath,
        debugNodeApis: devOptions.debugNodeApis,
        codegen: devOptions.codegen,
        liveComponentSources: devOptions.liveComponentSources,
        logManager, // Pass logManager to control logs during deploy
        largeIndexDeletionCheck: "no verification", // `convex dev` can’t push to prod
      },
      devOptions,
    ),
  );
  await Promise.race(promises);
  await ctx.flushAndExit(0);
}

export async function watchAndPush(
  outerCtx: OneoffCtx,
  options: PushOptions,
  cmdOptions: {
    run?:
      | { kind: "function"; name: string; component?: string | undefined }
      | { kind: "shell"; command: string }
      | undefined;
    once: boolean;
    untilSuccess: boolean;
    traceEvents: boolean;
  },
) {
  const watch: { watcher: Watcher | undefined } = { watcher: undefined };
  let numFailures = 0;
  let ran = false;
  let pushed = false;
  let tableNameTriggeringRetry;
  let shouldRetryOnDeploymentEnvVarChange;

  while (true) {
    const start = performance.now();
    tableNameTriggeringRetry = null;
    shouldRetryOnDeploymentEnvVarChange = false;

    const ctx = new WatchContext(
      cmdOptions.traceEvents,
      outerCtx.bigBrainAuth(),
    );
    options.logManager?.beginDeploy();
    showSpinner("Preparing Convex functions...");
    try {
      await runPush(ctx, options);
      const end = performance.now();
      // NOTE: If `runPush` throws, `endDeploy` will not be called.
      // This allows you to see the output from the failed deploy without
      // logs getting in the way.
      options.logManager?.endDeploy();
      numFailures = 0;
      logFinishedStep(
        `${getCurrentTimeString()} Convex functions ready! (${formatDuration(
          end - start,
        )})`,
      );
      if (cmdOptions.run !== undefined && !ran) {
        switch (cmdOptions.run.kind) {
          case "function":
            await runFunctionInDev(
              ctx,
              options,
              cmdOptions.run.name,
              cmdOptions.run.component,
            );
            break;
          case "shell":
            try {
              await spawnAsync(ctx, cmdOptions.run.command, [], {
                stdio: "inherit",
                shell: true,
              });
            } catch (e) {
              // `spawnAsync` throws an error like `{ status: 1, error: Error }`
              // when the command fails.
              const errorMessage =
                e === null || e === undefined
                  ? null
                  : (e as any).error instanceof Error
                    ? ((e as any).error.message ?? null)
                    : null;
              const printedMessage = `Failed to run command \`${cmdOptions.run.command}\`: ${errorMessage ?? "Unknown error"}`;
              // Don't return this since it'll bypass the `catch` below.
              await ctx.crash({
                exitCode: 1,
                errorType: "fatal",
                printedMessage,
              });
            }
            break;
          default: {
            cmdOptions.run satisfies never;
            // Don't return this since it'll bypass the `catch` below.
            await ctx.crash({
              exitCode: 1,
              errorType: "fatal",
              printedMessage: `Unexpected arguments for --run`,
              errForSentry: `Unexpected arguments for --run: ${JSON.stringify(
                cmdOptions.run,
              )}`,
            });
          }
        }
        ran = true;
      }
      pushed = true;
    } catch (e: any) {
      // Crash the app on unexpected errors.
      if (!(e instanceof Crash) || !e.errorType) {
        // eslint-disable-next-line no-restricted-syntax
        throw e;
      }
      if (e.errorType === "fatal") {
        break;
      }
      // Retry after an exponential backoff if we hit a transient error.
      if (e.errorType === "transient" || e.errorType === "already handled") {
        const delay = nextBackoff(numFailures);
        numFailures += 1;
        if (e.errorType === "transient") {
          logWarning(
            chalk.yellow(
              `Failed due to network error, retrying in ${formatDuration(
                delay,
              )}...`,
            ),
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Fall through if we had a filesystem-based error.
      // TODO(sarah): Replace this with `logError`.
      // eslint-disable-next-line no-console
      console.assert(
        e.errorType === "invalid filesystem data" ||
          e.errorType === "invalid filesystem or env vars" ||
          e.errorType["invalid filesystem or db data"] !== undefined,
      );
      if (e.errorType === "invalid filesystem or env vars") {
        shouldRetryOnDeploymentEnvVarChange = true;
      } else if (
        e.errorType !== "invalid filesystem data" &&
        e.errorType["invalid filesystem or db data"] !== undefined
      ) {
        tableNameTriggeringRetry = e.errorType["invalid filesystem or db data"];
      }
      if (cmdOptions.once) {
        await outerCtx.flushAndExit(1, e.errorType);
      }
      // Make sure that we don't spin if this push failed
      // in any edge cases that didn't call `logFailure`
      // before throwing.
      stopSpinner();
    }
    if (cmdOptions.once) {
      return;
    }
    if (pushed && cmdOptions.untilSuccess) {
      return;
    }
    const fileSystemWatch = getFileSystemWatch(ctx, watch, cmdOptions);
    const tableWatch = getTableWatch(
      ctx,
      options,
      tableNameTriggeringRetry?.tableName ?? null,
      tableNameTriggeringRetry?.componentPath,
    );
    const envVarWatch = getDeplymentEnvVarWatch(
      ctx,
      options,
      shouldRetryOnDeploymentEnvVarChange,
    );
    await Promise.race([
      fileSystemWatch.watch(),
      tableWatch.watch(),
      envVarWatch.watch(),
    ]);
    fileSystemWatch.stop();
    void tableWatch.stop();
    void envVarWatch.stop();
  }
}

async function runFunctionInDev(
  ctx: WatchContext,
  credentials: {
    url: string;
    adminKey: string;
  },
  functionName: string,
  componentPath: string | undefined,
) {
  await runFunctionAndLog(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    functionName,
    argsString: "{}",
    componentPath,
    callbacks: {
      onSuccess: () => {
        logFinishedStep(`Finished running function "${functionName}"`);
      },
    },
  });
}

function getTableWatch(
  ctx: WatchContext,
  credentials: {
    url: string;
    adminKey: string;
  },
  tableName: string | null,
  componentPath: string | undefined,
) {
  return getFunctionWatch(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    parsedFunctionName: "_system/cli/queryTable",
    getArgs: () => (tableName !== null ? { tableName } : null),
    componentPath,
  });
}

function getDeplymentEnvVarWatch(
  ctx: WatchContext,
  credentials: {
    url: string;
    adminKey: string;
  },
  shouldRetryOnDeploymentEnvVarChange: boolean,
) {
  return getFunctionWatch(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    parsedFunctionName: "_system/cli/queryEnvironmentVariables",
    getArgs: () => (shouldRetryOnDeploymentEnvVarChange ? {} : null),
    componentPath: undefined,
  });
}

function getFunctionWatch(
  ctx: WatchContext,
  args: {
    deploymentUrl: string;
    adminKey: string;
    parsedFunctionName: string;
    getArgs: () => Record<string, Value> | null;
    componentPath: string | undefined;
  },
) {
  const [stopPromise, stop] = waitUntilCalled();
  return {
    watch: async () => {
      const functionArgs = args.getArgs();
      if (functionArgs === null) {
        return waitForever();
      }
      let changes = 0;
      return subscribe(ctx, {
        deploymentUrl: args.deploymentUrl,
        adminKey: args.adminKey,
        parsedFunctionName: args.parsedFunctionName,
        parsedFunctionArgs: functionArgs,
        componentPath: args.componentPath,
        until: stopPromise,
        callbacks: {
          onChange: () => {
            changes++;
            // First bump is just the initial results reporting
            if (changes > 1) {
              stop();
            }
          },
        },
      });
    },
    stop: () => {
      stop();
    },
  };
}

function getFileSystemWatch(
  ctx: WatchContext,
  watch: { watcher: Watcher | undefined },
  cmdOptions: { traceEvents: boolean },
) {
  let hasStopped = false;
  return {
    watch: async () => {
      const observations = ctx.fs.finalize();
      if (observations === "invalidated") {
        logMessage("Filesystem changed during push, retrying...");
        return;
      }
      // Initialize the watcher if we haven't done it already. Chokidar expects to have a
      // nonempty watch set at initialization, so we can't do it before running our first
      // push.
      if (!watch.watcher) {
        watch.watcher = new Watcher(observations);
        await showSpinnerIfSlow(
          "Preparing to watch files...",
          500,
          async () => {
            await watch.watcher!.ready();
          },
        );
        stopSpinner();
      }
      // Watch new directories if needed.
      watch.watcher.update(observations);

      // Process events until we find one that overlaps with our previous observations.
      let anyChanges = false;
      do {
        await watch.watcher.waitForEvent();
        if (hasStopped) {
          return;
        }
        for (const event of watch.watcher.drainEvents()) {
          if (cmdOptions.traceEvents) {
            logMessage(
              "Processing",
              event.name,
              path.relative("", event.absPath),
            );
          }
          const result = observations.overlaps(event);
          if (result.overlaps) {
            const relPath = path.relative("", event.absPath);
            if (cmdOptions.traceEvents) {
              logMessage(`${relPath} ${result.reason}, rebuilding...`);
            }
            anyChanges = true;
            break;
          }
        }
      } while (!anyChanges);

      // Wait for the filesystem to quiesce before starting a new push. It's okay to
      // drop filesystem events at this stage since we're already committed to doing
      // a push and resubscribing based on that push's observations.
      let deadline = performance.now() + quiescenceDelay;
      while (true) {
        const now = performance.now();
        if (now >= deadline) {
          break;
        }
        const remaining = deadline - now;
        if (cmdOptions.traceEvents) {
          logMessage(`Waiting for ${formatDuration(remaining)} to quiesce...`);
        }
        const remainingWait = new Promise<"timeout">((resolve) =>
          setTimeout(() => resolve("timeout"), deadline - now),
        );
        const result = await Promise.race([
          remainingWait,
          watch.watcher.waitForEvent().then<"newEvents">(() => "newEvents"),
        ]);
        if (result === "newEvents") {
          for (const event of watch.watcher.drainEvents()) {
            const result = observations.overlaps(event);
            // Delay another `quiescenceDelay` since we had an overlapping event.
            if (result.overlaps) {
              if (cmdOptions.traceEvents) {
                logMessage(
                  `Received an overlapping event at ${event.absPath}, delaying push.`,
                );
              }
              deadline = performance.now() + quiescenceDelay;
            }
          }
        } else {
          // Let the check above `break` from the loop if we're past our deadlne.
          if (result !== "timeout") {
            logError(
              "Assertion failed: Unexpected result from watcher: " + result,
            );
          }
        }
      }
    },
    stop: () => {
      hasStopped = true;
    },
  };
}

const initialBackoff = 500;
const maxBackoff = 16000;
const quiescenceDelay = 500;

export function nextBackoff(prevFailures: number): number {
  const baseBackoff = initialBackoff * Math.pow(2, prevFailures);
  const actualBackoff = Math.min(baseBackoff, maxBackoff);
  const jitter = actualBackoff * (Math.random() - 0.5);
  return actualBackoff + jitter;
}
