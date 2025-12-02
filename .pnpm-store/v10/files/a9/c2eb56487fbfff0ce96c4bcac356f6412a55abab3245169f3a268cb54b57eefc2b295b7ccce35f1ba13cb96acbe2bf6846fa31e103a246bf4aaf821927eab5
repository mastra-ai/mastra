"use strict";
import chalk from "chalk";
import {
  logError,
  logFinishedStep,
  logMessage,
  logWarning,
  showSpinner,
  showSpinnerIfSlow,
  stopSpinner
} from "../../bundler/log.js";
import { runPush } from "./components.js";
import { performance } from "perf_hooks";
import path from "path";
import { LogManager, watchLogs } from "./logs.js";
import {
  formatDuration,
  getCurrentTimeString,
  spawnAsync,
  waitForever,
  waitUntilCalled
} from "./utils/utils.js";
import { Crash, WatchContext, Watcher } from "./watch.js";
import { runFunctionAndLog, subscribe } from "./run.js";
export async function devAgainstDeployment(ctx, credentials, devOptions) {
  const logManager = new LogManager(devOptions.tailLogs);
  const promises = [];
  if (devOptions.tailLogs !== "disable") {
    promises.push(
      watchLogs(ctx, credentials.url, credentials.adminKey, "stderr", {
        logManager,
        success: false
      })
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
        logManager,
        // Pass logManager to control logs during deploy
        largeIndexDeletionCheck: "no verification"
        // `convex dev` can’t push to prod
      },
      devOptions
    )
  );
  await Promise.race(promises);
  await ctx.flushAndExit(0);
}
export async function watchAndPush(outerCtx, options, cmdOptions) {
  const watch = { watcher: void 0 };
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
      outerCtx.bigBrainAuth()
    );
    options.logManager?.beginDeploy();
    showSpinner("Preparing Convex functions...");
    try {
      await runPush(ctx, options);
      const end = performance.now();
      options.logManager?.endDeploy();
      numFailures = 0;
      logFinishedStep(
        `${getCurrentTimeString()} Convex functions ready! (${formatDuration(
          end - start
        )})`
      );
      if (cmdOptions.run !== void 0 && !ran) {
        switch (cmdOptions.run.kind) {
          case "function":
            await runFunctionInDev(
              ctx,
              options,
              cmdOptions.run.name,
              cmdOptions.run.component
            );
            break;
          case "shell":
            try {
              await spawnAsync(ctx, cmdOptions.run.command, [], {
                stdio: "inherit",
                shell: true
              });
            } catch (e) {
              const errorMessage = e === null || e === void 0 ? null : e.error instanceof Error ? e.error.message ?? null : null;
              const printedMessage = `Failed to run command \`${cmdOptions.run.command}\`: ${errorMessage ?? "Unknown error"}`;
              await ctx.crash({
                exitCode: 1,
                errorType: "fatal",
                printedMessage
              });
            }
            break;
          default: {
            cmdOptions.run;
            await ctx.crash({
              exitCode: 1,
              errorType: "fatal",
              printedMessage: `Unexpected arguments for --run`,
              errForSentry: `Unexpected arguments for --run: ${JSON.stringify(
                cmdOptions.run
              )}`
            });
          }
        }
        ran = true;
      }
      pushed = true;
    } catch (e) {
      if (!(e instanceof Crash) || !e.errorType) {
        throw e;
      }
      if (e.errorType === "fatal") {
        break;
      }
      if (e.errorType === "transient" || e.errorType === "already handled") {
        const delay = nextBackoff(numFailures);
        numFailures += 1;
        if (e.errorType === "transient") {
          logWarning(
            chalk.yellow(
              `Failed due to network error, retrying in ${formatDuration(
                delay
              )}...`
            )
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      console.assert(
        e.errorType === "invalid filesystem data" || e.errorType === "invalid filesystem or env vars" || e.errorType["invalid filesystem or db data"] !== void 0
      );
      if (e.errorType === "invalid filesystem or env vars") {
        shouldRetryOnDeploymentEnvVarChange = true;
      } else if (e.errorType !== "invalid filesystem data" && e.errorType["invalid filesystem or db data"] !== void 0) {
        tableNameTriggeringRetry = e.errorType["invalid filesystem or db data"];
      }
      if (cmdOptions.once) {
        await outerCtx.flushAndExit(1, e.errorType);
      }
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
      tableNameTriggeringRetry?.componentPath
    );
    const envVarWatch = getDeplymentEnvVarWatch(
      ctx,
      options,
      shouldRetryOnDeploymentEnvVarChange
    );
    await Promise.race([
      fileSystemWatch.watch(),
      tableWatch.watch(),
      envVarWatch.watch()
    ]);
    fileSystemWatch.stop();
    void tableWatch.stop();
    void envVarWatch.stop();
  }
}
async function runFunctionInDev(ctx, credentials, functionName, componentPath) {
  await runFunctionAndLog(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    functionName,
    argsString: "{}",
    componentPath,
    callbacks: {
      onSuccess: () => {
        logFinishedStep(`Finished running function "${functionName}"`);
      }
    }
  });
}
function getTableWatch(ctx, credentials, tableName, componentPath) {
  return getFunctionWatch(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    parsedFunctionName: "_system/cli/queryTable",
    getArgs: () => tableName !== null ? { tableName } : null,
    componentPath
  });
}
function getDeplymentEnvVarWatch(ctx, credentials, shouldRetryOnDeploymentEnvVarChange) {
  return getFunctionWatch(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    parsedFunctionName: "_system/cli/queryEnvironmentVariables",
    getArgs: () => shouldRetryOnDeploymentEnvVarChange ? {} : null,
    componentPath: void 0
  });
}
function getFunctionWatch(ctx, args) {
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
            if (changes > 1) {
              stop();
            }
          }
        }
      });
    },
    stop: () => {
      stop();
    }
  };
}
function getFileSystemWatch(ctx, watch, cmdOptions) {
  let hasStopped = false;
  return {
    watch: async () => {
      const observations = ctx.fs.finalize();
      if (observations === "invalidated") {
        logMessage("Filesystem changed during push, retrying...");
        return;
      }
      if (!watch.watcher) {
        watch.watcher = new Watcher(observations);
        await showSpinnerIfSlow(
          "Preparing to watch files...",
          500,
          async () => {
            await watch.watcher.ready();
          }
        );
        stopSpinner();
      }
      watch.watcher.update(observations);
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
              path.relative("", event.absPath)
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
        const remainingWait = new Promise(
          (resolve) => setTimeout(() => resolve("timeout"), deadline - now)
        );
        const result = await Promise.race([
          remainingWait,
          watch.watcher.waitForEvent().then(() => "newEvents")
        ]);
        if (result === "newEvents") {
          for (const event of watch.watcher.drainEvents()) {
            const result2 = observations.overlaps(event);
            if (result2.overlaps) {
              if (cmdOptions.traceEvents) {
                logMessage(
                  `Received an overlapping event at ${event.absPath}, delaying push.`
                );
              }
              deadline = performance.now() + quiescenceDelay;
            }
          }
        } else {
          if (result !== "timeout") {
            logError(
              "Assertion failed: Unexpected result from watcher: " + result
            );
          }
        }
      }
    },
    stop: () => {
      hasStopped = true;
    }
  };
}
const initialBackoff = 500;
const maxBackoff = 16e3;
const quiescenceDelay = 500;
export function nextBackoff(prevFailures) {
  const baseBackoff = initialBackoff * Math.pow(2, prevFailures);
  const actualBackoff = Math.min(baseBackoff, maxBackoff);
  const jitter = actualBackoff * (Math.random() - 0.5);
  return actualBackoff + jitter;
}
//# sourceMappingURL=dev.js.map
