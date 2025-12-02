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
var deploy2_exports = {};
__export(deploy2_exports, {
  deployToDeployment: () => deployToDeployment,
  evaluatePush: () => evaluatePush,
  fetchDeploymentCanonicalCloudUrl: () => fetchDeploymentCanonicalCloudUrl,
  finishPush: () => finishPush,
  reportPushCompleted: () => reportPushCompleted,
  runCommand: () => runCommand,
  startPush: () => startPush,
  waitForSchema: () => waitForSchema
});
module.exports = __toCommonJS(deploy2_exports);
var import_log = require("../../bundler/log.js");
var import_child_process = require("child_process");
var import_utils = require("./utils/utils.js");
var import_startPush = require("./deployApi/startPush.js");
var import_chalk = __toESM(require("chalk"), 1);
var import_finishPush = require("./deployApi/finishPush.js");
var import_node_util = require("node:util");
var import_node_zlib = __toESM(require("node:zlib"), 1);
var import_components2 = require("./components.js");
var import_envvars = require("./envvars.js");
var import_run = require("./run.js");
var import_config = require("./config.js");
var import_dashboard = require("./dashboard.js");
var import_indexes = require("./indexes.js");
const brotli = (0, import_node_util.promisify)(import_node_zlib.default.brotliCompress);
async function brotliCompress(ctx, data) {
  const start = performance.now();
  const result = await brotli(data, {
    params: {
      [import_node_zlib.default.constants.BROTLI_PARAM_MODE]: import_node_zlib.default.constants.BROTLI_MODE_TEXT,
      [import_node_zlib.default.constants.BROTLI_PARAM_QUALITY]: 4
    }
  });
  const end = performance.now();
  const duration = end - start;
  (0, import_log.logVerbose)(
    `Compressed ${(data.length / 1024).toFixed(2)}KiB to ${(result.length / 1024).toFixed(2)}KiB (${(result.length / data.length * 100).toFixed(2)}%) in ${duration.toFixed(2)}ms`
  );
  return result;
}
async function startPush(ctx, span, request, options) {
  const response = await pushCode(
    ctx,
    span,
    request,
    options,
    "/api/deploy2/start_push"
  );
  return import_startPush.startPushResponse.parse(response);
}
async function evaluatePush(ctx, span, request, options) {
  const response = await pushCode(
    ctx,
    span,
    request,
    options,
    "/api/deploy2/evaluate_push"
  );
  return import_startPush.evaluatePushResponse.parse(response);
}
async function pushCode(ctx, span, request, options, endpoint) {
  const custom = (_k, s) => typeof s === "string" ? s.slice(0, 40) + (s.length > 40 ? "..." : "") : s;
  (0, import_log.logVerbose)(JSON.stringify(request, custom, 2));
  const onError = (err) => {
    if (err.toString() === "TypeError: fetch failed") {
      (0, import_log.changeSpinner)(`Fetch failed, is ${options.url} correct? Retrying...`);
    }
  };
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl: options.url,
    adminKey: request.adminKey,
    onError
  });
  try {
    const response = await fetch(endpoint, {
      body: await brotliCompress(ctx, JSON.stringify(request)),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "br",
        traceparent: span.encodeW3CTraceparent()
      }
    });
    return await response.json();
  } catch (error) {
    return await (0, import_config.handlePushConfigError)(
      ctx,
      error,
      "Error: Unable to start push to " + options.url,
      options.deploymentName,
      {
        adminKey: request.adminKey,
        deploymentUrl: options.url,
        deploymentNotice: ""
      }
    );
  }
}
const SCHEMA_TIMEOUT_MS = 1e4;
async function waitForSchema(ctx, span, startPush2, options) {
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl: options.url,
    adminKey: options.adminKey
  });
  const start = Date.now();
  (0, import_log.changeSpinner)("Pushing code to your Convex deployment...");
  while (true) {
    let currentStatus;
    try {
      const response = await fetch("/api/deploy2/wait_for_schema", {
        body: JSON.stringify({
          adminKey: options.adminKey,
          schemaChange: startPush2.schemaChange,
          timeoutMs: SCHEMA_TIMEOUT_MS,
          dryRun: options.dryRun
        }),
        method: "POST",
        headers: {
          traceparent: span.encodeW3CTraceparent()
        }
      });
      currentStatus = import_startPush.schemaStatus.parse(await response.json());
    } catch (error) {
      (0, import_log.logFailure)("Error: Unable to wait for schema from " + options.url);
      return await (0, import_utils.logAndHandleFetchError)(ctx, error);
    }
    switch (currentStatus.type) {
      case "inProgress": {
        let schemaDone = true;
        let indexesComplete = 0;
        let indexesTotal = 0;
        for (const componentStatus of Object.values(currentStatus.components)) {
          if (!componentStatus.schemaValidationComplete) {
            schemaDone = false;
          }
          indexesComplete += componentStatus.indexesComplete;
          indexesTotal += componentStatus.indexesTotal;
        }
        const indexesDone = indexesComplete === indexesTotal;
        let msg;
        if (!indexesDone && !schemaDone) {
          msg = (0, import_indexes.addProgressLinkIfSlow)(
            `Backfilling indexes (${indexesComplete}/${indexesTotal} ready) and checking that documents match your schema...`,
            options.deploymentName,
            start
          );
        } else if (!indexesDone) {
          msg = `Backfilling indexes (${indexesComplete}/${indexesTotal} ready)...`;
          if (Date.now() - start > 1e4) {
            const rootDiff = startPush2.schemaChange.indexDiffs?.[""];
            const indexName = (rootDiff?.added_indexes[0] || rootDiff?.enabled_indexes?.[0])?.name;
            if (indexName) {
              const table = indexName.split(".")[0];
              const dashboardUrl = (0, import_dashboard.deploymentDashboardUrlPage)(
                options.deploymentName,
                `/data?table=${table}&showIndexes=true`
              );
              msg = `Backfilling index ${indexName} (${indexesComplete}/${indexesTotal} ready), see progress here: ${dashboardUrl}`;
            }
          }
        } else {
          msg = (0, import_indexes.addProgressLinkIfSlow)(
            "Checking that documents match your schema...",
            options.deploymentName,
            start
          );
        }
        (0, import_log.changeSpinner)(msg);
        break;
      }
      case "failed": {
        let msg = "Schema validation failed";
        if (currentStatus.componentPath) {
          msg += ` in component "${currentStatus.componentPath}"`;
        }
        msg += ".";
        (0, import_log.logFailure)(msg);
        (0, import_log.logError)(import_chalk.default.red(`${currentStatus.error}`));
        return await ctx.crash({
          exitCode: 1,
          errorType: {
            "invalid filesystem or db data": currentStatus.tableName ? {
              tableName: currentStatus.tableName,
              componentPath: currentStatus.componentPath
            } : null
          },
          printedMessage: null
          // TODO - move logging into here
        });
      }
      case "raceDetected": {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Schema was overwritten by another push.`
        });
      }
      case "complete": {
        (0, import_log.changeSpinner)("Schema validation complete.");
        return;
      }
    }
  }
}
async function finishPush(ctx, span, startPush2, options) {
  (0, import_log.changeSpinner)("Finalizing push...");
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl: options.url,
    adminKey: options.adminKey
  });
  const request = {
    adminKey: options.adminKey,
    startPush: startPush2,
    dryRun: options.dryRun
  };
  try {
    const response = await fetch("/api/deploy2/finish_push", {
      body: await brotliCompress(ctx, JSON.stringify(request)),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "br",
        traceparent: span.encodeW3CTraceparent()
      }
    });
    return import_finishPush.finishPushDiff.parse(await response.json());
  } catch (error) {
    return await (0, import_config.handlePushConfigError)(
      ctx,
      error,
      "Error: Unable to finish push to " + options.url,
      options.deploymentName,
      {
        adminKey: options.adminKey,
        deploymentUrl: options.url,
        deploymentNotice: ""
      }
    );
  }
}
async function reportPushCompleted(ctx, adminKey, url, reporter) {
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl: url,
    adminKey
  });
  try {
    const response = await fetch("/api/deploy2/report_push_completed", {
      body: JSON.stringify({
        adminKey,
        spans: reporter.spans
      }),
      method: "POST"
    });
    await response.json();
  } catch (error) {
    (0, import_log.logFailure)(
      "Error: Unable to report push completed to " + url + ": " + error
    );
  }
}
async function deployToDeployment(ctx, credentials, options) {
  const { url, adminKey } = credentials;
  await runCommand(ctx, { ...options, url, adminKey });
  const pushOptions = {
    deploymentName: credentials.deploymentName,
    adminKey,
    verbose: !!options.verbose,
    dryRun: !!options.dryRun,
    typecheck: options.typecheck,
    typecheckComponents: options.typecheckComponents,
    debug: !!options.debug,
    debugBundlePath: options.debugBundlePath,
    debugNodeApis: false,
    codegen: options.codegen === "enable",
    url,
    writePushRequest: options.writePushRequest,
    liveComponentSources: !!options.liveComponentSources,
    largeIndexDeletionCheck: options.allowDeletingLargeIndexes ? "has confirmation" : "ask for confirmation"
  };
  (0, import_log.showSpinner)(`Deploying to ${url}...${options.dryRun ? " [dry run]" : ""}`);
  await (0, import_components2.runPush)(ctx, pushOptions);
  (0, import_log.logFinishedStep)(
    `${options.dryRun ? "Would have deployed" : "Deployed"} Convex functions to ${url}`
  );
}
async function runCommand(ctx, options) {
  if (options.cmd === void 0) {
    return;
  }
  const urlVar = options.cmdUrlEnvVarName ?? (await (0, import_envvars.suggestedEnvVarName)(ctx)).envVar;
  (0, import_log.showSpinner)(
    `Running '${options.cmd}' with environment variable "${urlVar}" set...${options.dryRun ? " [dry run]" : ""}`
  );
  if (!options.dryRun) {
    const canonicalCloudUrl = await fetchDeploymentCanonicalCloudUrl(ctx, {
      deploymentUrl: options.url,
      adminKey: options.adminKey
    });
    const env = { ...process.env };
    env[urlVar] = canonicalCloudUrl;
    const result = (0, import_child_process.spawnSync)(options.cmd, {
      env,
      stdio: "inherit",
      shell: true
    });
    if (result.status !== 0) {
      await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `'${options.cmd}' failed`
      });
    }
  }
  (0, import_log.logFinishedStep)(
    `${options.dryRun ? "Would have run" : "Ran"} "${options.cmd}" with environment variable "${urlVar}" set`
  );
}
async function fetchDeploymentCanonicalCloudUrl(ctx, options) {
  const result = await (0, import_run.runSystemQuery)(ctx, {
    ...options,
    functionName: "_system/cli/convexUrl:cloudUrl",
    componentPath: void 0,
    args: {}
  });
  if (typeof result !== "string") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      printedMessage: "Invalid process.env.CONVEX_CLOUD_URL"
    });
  }
  return result;
}
//# sourceMappingURL=deploy2.js.map
