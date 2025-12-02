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
var run_exports = {};
__export(run_exports, {
  assertLocalBackendRunning: () => assertLocalBackendRunning,
  ensureBackendRunning: () => ensureBackendRunning,
  ensureBackendStopped: () => ensureBackendStopped,
  localDeploymentUrl: () => localDeploymentUrl,
  runLocalBackend: () => runLocalBackend,
  selfHostedEventTag: () => selfHostedEventTag
});
module.exports = __toCommonJS(run_exports);
var import_log = require("../../../bundler/log.js");
var import_filePaths = require("./filePaths.js");
var import_path = __toESM(require("path"), 1);
var import_child_process = __toESM(require("child_process"), 1);
var import_detect_port = __toESM(require("detect-port"), 1);
var import_sentry = require("../utils/sentry.js");
var import_crypto = require("crypto");
var import_errors = require("./errors.js");
async function runLocalBackend(ctx, args) {
  const { ports } = args;
  const deploymentDir = (0, import_filePaths.deploymentStateDir)(
    args.deploymentKind,
    args.deploymentName
  );
  ctx.fs.mkdir(deploymentDir, { recursive: true });
  const deploymentNameSha = (0, import_crypto.createHash)("sha256").update(args.deploymentName).digest("hex");
  const commandArgs = [
    "--port",
    ports.cloud.toString(),
    "--site-proxy-port",
    ports.site.toString(),
    "--sentry-identifier",
    deploymentNameSha,
    "--instance-name",
    args.deploymentName,
    "--instance-secret",
    args.instanceSecret,
    "--local-storage",
    import_path.default.join(deploymentDir, "convex_local_storage"),
    "--beacon-tag",
    selfHostedEventTag(args.deploymentKind),
    import_path.default.join(deploymentDir, "convex_local_backend.sqlite3")
  ];
  if (args.isLatestVersion) {
    if (args.deploymentKind === "anonymous") {
      const uuid = (0, import_filePaths.loadUuidForAnonymousUser)(ctx);
      if (uuid !== null) {
        commandArgs.push(
          "--beacon-fields",
          JSON.stringify({
            override_uuid: uuid
          })
        );
      }
    }
  }
  try {
    const result = import_child_process.default.spawnSync(args.binaryPath, [
      ...commandArgs,
      "--help"
    ]);
    if (result.status === 3221225781) {
      const message = "Local backend exited because shared libraries are missing. These may include libraries installed via 'Microsoft Visual C++ Redistributable for Visual Studio.'";
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: message,
        errForSentry: new import_errors.LocalDeploymentError(
          "Local backend exited with code 3221225781"
        )
      });
    } else if (result.status !== 0) {
      const message = `Failed to run backend binary, exit code ${result.status}, error: ${result.stderr === null ? "null" : result.stderr.toString()}`;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: message,
        errForSentry: new import_errors.LocalDeploymentError(message)
      });
    }
  } catch (e) {
    const message = `Failed to run backend binary: ${e.toString()}`;
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new import_errors.LocalDeploymentError(message)
    });
  }
  const commandStr = `${args.binaryPath} ${commandArgs.join(" ")}`;
  (0, import_log.logVerbose)(`Starting local backend: \`${commandStr}\``);
  const p = import_child_process.default.spawn(args.binaryPath, commandArgs, {
    stdio: "ignore",
    env: {
      ...process.env,
      SENTRY_DSN: import_sentry.SENTRY_DSN
    }
  }).on("exit", (code) => {
    const why = code === null ? "from signal" : `with code ${code}`;
    (0, import_log.logVerbose)(`Local backend exited ${why}, full command \`${commandStr}\``);
  });
  const cleanupHandle = ctx.registerCleanup(async () => {
    (0, import_log.logVerbose)(`Stopping local backend on port ${ports.cloud}`);
    p.kill("SIGTERM");
  });
  await ensureBackendRunning(ctx, {
    cloudPort: ports.cloud,
    deploymentName: args.deploymentName,
    maxTimeSecs: 30
  });
  return {
    cleanupHandle
  };
}
async function assertLocalBackendRunning(ctx, args) {
  (0, import_log.logVerbose)(`Checking local backend at ${args.url} is running`);
  try {
    const resp = await fetch(`${args.url}/instance_name`);
    if (resp.status === 200) {
      const text = await resp.text();
      if (text !== args.deploymentName) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `A different local backend ${text} is running at ${args.url}`
        });
      } else {
        return;
      }
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error response code received from local backend ${resp.status} ${resp.statusText}`
      });
    }
  } catch {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Local backend isn't running. (it's not listening at ${args.url})
Run \`npx convex dev\` in another terminal first.`
    });
  }
}
async function ensureBackendRunning(ctx, args) {
  (0, import_log.logVerbose)(`Ensuring backend running on port ${args.cloudPort} is running`);
  const deploymentUrl = localDeploymentUrl(args.cloudPort);
  let timeElapsedSecs = 0;
  let hasShownWaiting = false;
  while (timeElapsedSecs <= args.maxTimeSecs) {
    if (!hasShownWaiting && timeElapsedSecs > 2) {
      (0, import_log.logMessage)("waiting for local backend to start...");
      hasShownWaiting = true;
    }
    try {
      const resp = await fetch(`${deploymentUrl}/instance_name`);
      if (resp.status === 200) {
        const text = await resp.text();
        if (text !== args.deploymentName) {
          return await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `A different local backend ${text} is running on selected port ${args.cloudPort}`
          });
        } else {
          return;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
        timeElapsedSecs += 0.5;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      timeElapsedSecs += 0.5;
    }
  }
  const message = `Local backend did not start on port ${args.cloudPort} within ${args.maxTimeSecs} seconds.`;
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: message,
    errForSentry: new import_errors.LocalDeploymentError(message)
  });
}
async function ensureBackendStopped(ctx, args) {
  (0, import_log.logVerbose)(`Ensuring backend running on port ${args.ports.cloud} is stopped`);
  let timeElapsedSecs = 0;
  while (timeElapsedSecs < args.maxTimeSecs) {
    const cloudPort = await (0, import_detect_port.default)(args.ports.cloud);
    const sitePort = args.ports.site === void 0 ? void 0 : await (0, import_detect_port.default)(args.ports.site);
    if (cloudPort === args.ports.cloud && sitePort === args.ports.site) {
      return;
    }
    try {
      const instanceNameResp = await fetch(
        `${localDeploymentUrl(args.ports.cloud)}/instance_name`
      );
      if (instanceNameResp.ok) {
        const instanceName = await instanceNameResp.text();
        if (instanceName !== args.deploymentName) {
          if (args.allowOtherDeployments) {
            return;
          }
          return await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `A different local backend ${instanceName} is running on selected port ${args.ports.cloud}`
          });
        }
      }
    } catch (error) {
      (0, import_log.logVerbose)(`Error checking if backend is running: ${error.message}`);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    timeElapsedSecs += 0.5;
  }
  return ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `A local backend is still running on port ${args.ports.cloud}. Please stop it and run this command again.`
  });
}
function localDeploymentUrl(cloudPort) {
  return `http://127.0.0.1:${cloudPort}`;
}
function selfHostedEventTag(deploymentKind) {
  return deploymentKind === "local" ? "cli-local-dev" : "cli-anonymous-dev";
}
//# sourceMappingURL=run.js.map
