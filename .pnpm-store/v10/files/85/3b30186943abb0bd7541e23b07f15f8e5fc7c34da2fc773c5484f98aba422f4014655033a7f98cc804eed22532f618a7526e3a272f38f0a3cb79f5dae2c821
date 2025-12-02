"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dev_exports = {};
__export(dev_exports, {
  devAgainstDeployment: () => devAgainstDeployment,
  nextBackoff: () => nextBackoff,
  watchAndPush: () => watchAndPush
});
module.exports = __toCommonJS(dev_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_components = require("./components.js");
var import_perf_hooks = require("perf_hooks");
var import_path = __toESM(require("path"), 1);
var import_logs = require("./logs.js");
var import_utils = require("./utils/utils.js");
var import_watch = require("./watch.js");
var import_run = require("./run.js");
async function devAgainstDeployment(ctx, credentials, devOptions) {
  const logManager = new import_logs.LogManager(devOptions.tailLogs);
  const promises = [];
  if (devOptions.tailLogs !== "disable") {
    promises.push(
      (0, import_logs.watchLogs)(ctx, credentials.url, credentials.adminKey, "stderr", {
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
async function watchAndPush(outerCtx, options, cmdOptions) {
  const watch = { watcher: void 0 };
  let numFailures = 0;
  let ran = false;
  let pushed = false;
  let tableNameTriggeringRetry;
  let shouldRetryOnDeploymentEnvVarChange;
  while (true) {
    const start = import_perf_hooks.performance.now();
    tableNameTriggeringRetry = null;
    shouldRetryOnDeploymentEnvVarChange = false;
    const ctx = new import_watch.WatchContext(
      cmdOptions.traceEvents,
      outerCtx.bigBrainAuth()
    );
    options.logManager?.beginDeploy();
    (0, import_log.showSpinner)("Preparing Convex functions...");
    try {
      await (0, import_components.runPush)(ctx, options);
      const end = import_perf_hooks.performance.now();
      options.logManager?.endDeploy();
      numFailures = 0;
      (0, import_log.logFinishedStep)(
        `${(0, import_utils.getCurrentTimeString)()} Convex functions ready! (${(0, import_utils.formatDuration)(
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
              await (0, import_utils.spawnAsync)(ctx, cmdOptions.run.command, [], {
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
      if (!(e instanceof import_watch.Crash) || !e.errorType) {
        throw e;
      }
      if (e.errorType === "fatal") {
        break;
      }
      if (e.errorType === "transient" || e.errorType === "already handled") {
        const delay = nextBackoff(numFailures);
        numFailures += 1;
        if (e.errorType === "transient") {
          (0, import_log.logWarning)(
            import_chalk.default.yellow(
              `Failed due to network error, retrying in ${(0, import_utils.formatDuration)(
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
      (0, import_log.stopSpinner)();
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
  await (0, import_run.runFunctionAndLog)(ctx, {
    deploymentUrl: credentials.url,
    adminKey: credentials.adminKey,
    functionName,
    argsString: "{}",
    componentPath,
    callbacks: {
      onSuccess: () => {
        (0, import_log.logFinishedStep)(`Finished running function "${functionName}"`);
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
  const [stopPromise, stop] = (0, import_utils.waitUntilCalled)();
  return {
    watch: async () => {
      const functionArgs = args.getArgs();
      if (functionArgs === null) {
        return (0, import_utils.waitForever)();
      }
      let changes = 0;
      return (0, import_run.subscribe)(ctx, {
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
        (0, import_log.logMessage)("Filesystem changed during push, retrying...");
        return;
      }
      if (!watch.watcher) {
        watch.watcher = new import_watch.Watcher(observations);
        await (0, import_log.showSpinnerIfSlow)(
          "Preparing to watch files...",
          500,
          async () => {
            await watch.watcher.ready();
          }
        );
        (0, import_log.stopSpinner)();
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
            (0, import_log.logMessage)(
              "Processing",
              event.name,
              import_path.default.relative("", event.absPath)
            );
          }
          const result = observations.overlaps(event);
          if (result.overlaps) {
            const relPath = import_path.default.relative("", event.absPath);
            if (cmdOptions.traceEvents) {
              (0, import_log.logMessage)(`${relPath} ${result.reason}, rebuilding...`);
            }
            anyChanges = true;
            break;
          }
        }
      } while (!anyChanges);
      let deadline = import_perf_hooks.performance.now() + quiescenceDelay;
      while (true) {
        const now = import_perf_hooks.performance.now();
        if (now >= deadline) {
          break;
        }
        const remaining = deadline - now;
        if (cmdOptions.traceEvents) {
          (0, import_log.logMessage)(`Waiting for ${(0, import_utils.formatDuration)(remaining)} to quiesce...`);
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
                (0, import_log.logMessage)(
                  `Received an overlapping event at ${event.absPath}, delaying push.`
                );
              }
              deadline = import_perf_hooks.performance.now() + quiescenceDelay;
            }
          }
        } else {
          if (result !== "timeout") {
            (0, import_log.logError)(
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
function nextBackoff(prevFailures) {
  const baseBackoff = initialBackoff * Math.pow(2, prevFailures);
  const actualBackoff = Math.min(baseBackoff, maxBackoff);
  const jitter = actualBackoff * (Math.random() - 0.5);
  return actualBackoff + jitter;
}
//# sourceMappingURL=dev.js.map
