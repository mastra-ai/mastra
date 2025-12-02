"use strict";
import {
  changeSpinner,
  logError,
  logFailure,
  logFinishedStep,
  logVerbose,
  showSpinner
} from "../../bundler/log.js";
import { spawnSync } from "child_process";
import { deploymentFetch, logAndHandleFetchError } from "./utils/utils.js";
import {
  evaluatePushResponse,
  schemaStatus,
  startPushResponse
} from "./deployApi/startPush.js";
import chalk from "chalk";
import { finishPushDiff } from "./deployApi/finishPush.js";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { runPush } from "./components.js";
import { suggestedEnvVarName } from "./envvars.js";
import { runSystemQuery } from "./run.js";
import { handlePushConfigError } from "./config.js";
import { deploymentDashboardUrlPage } from "./dashboard.js";
import { addProgressLinkIfSlow } from "./indexes.js";
const brotli = promisify(zlib.brotliCompress);
async function brotliCompress(ctx, data) {
  const start = performance.now();
  const result = await brotli(data, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4
    }
  });
  const end = performance.now();
  const duration = end - start;
  logVerbose(
    `Compressed ${(data.length / 1024).toFixed(2)}KiB to ${(result.length / 1024).toFixed(2)}KiB (${(result.length / data.length * 100).toFixed(2)}%) in ${duration.toFixed(2)}ms`
  );
  return result;
}
export async function startPush(ctx, span, request, options) {
  const response = await pushCode(
    ctx,
    span,
    request,
    options,
    "/api/deploy2/start_push"
  );
  return startPushResponse.parse(response);
}
export async function evaluatePush(ctx, span, request, options) {
  const response = await pushCode(
    ctx,
    span,
    request,
    options,
    "/api/deploy2/evaluate_push"
  );
  return evaluatePushResponse.parse(response);
}
async function pushCode(ctx, span, request, options, endpoint) {
  const custom = (_k, s) => typeof s === "string" ? s.slice(0, 40) + (s.length > 40 ? "..." : "") : s;
  logVerbose(JSON.stringify(request, custom, 2));
  const onError = (err) => {
    if (err.toString() === "TypeError: fetch failed") {
      changeSpinner(`Fetch failed, is ${options.url} correct? Retrying...`);
    }
  };
  const fetch = deploymentFetch(ctx, {
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
    return await handlePushConfigError(
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
export async function waitForSchema(ctx, span, startPush2, options) {
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: options.url,
    adminKey: options.adminKey
  });
  const start = Date.now();
  changeSpinner("Pushing code to your Convex deployment...");
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
      currentStatus = schemaStatus.parse(await response.json());
    } catch (error) {
      logFailure("Error: Unable to wait for schema from " + options.url);
      return await logAndHandleFetchError(ctx, error);
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
          msg = addProgressLinkIfSlow(
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
              const dashboardUrl = deploymentDashboardUrlPage(
                options.deploymentName,
                `/data?table=${table}&showIndexes=true`
              );
              msg = `Backfilling index ${indexName} (${indexesComplete}/${indexesTotal} ready), see progress here: ${dashboardUrl}`;
            }
          }
        } else {
          msg = addProgressLinkIfSlow(
            "Checking that documents match your schema...",
            options.deploymentName,
            start
          );
        }
        changeSpinner(msg);
        break;
      }
      case "failed": {
        let msg = "Schema validation failed";
        if (currentStatus.componentPath) {
          msg += ` in component "${currentStatus.componentPath}"`;
        }
        msg += ".";
        logFailure(msg);
        logError(chalk.red(`${currentStatus.error}`));
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
        changeSpinner("Schema validation complete.");
        return;
      }
    }
  }
}
export async function finishPush(ctx, span, startPush2, options) {
  changeSpinner("Finalizing push...");
  const fetch = deploymentFetch(ctx, {
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
    return finishPushDiff.parse(await response.json());
  } catch (error) {
    return await handlePushConfigError(
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
export async function reportPushCompleted(ctx, adminKey, url, reporter) {
  const fetch = deploymentFetch(ctx, {
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
    logFailure(
      "Error: Unable to report push completed to " + url + ": " + error
    );
  }
}
export async function deployToDeployment(ctx, credentials, options) {
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
  showSpinner(`Deploying to ${url}...${options.dryRun ? " [dry run]" : ""}`);
  await runPush(ctx, pushOptions);
  logFinishedStep(
    `${options.dryRun ? "Would have deployed" : "Deployed"} Convex functions to ${url}`
  );
}
export async function runCommand(ctx, options) {
  if (options.cmd === void 0) {
    return;
  }
  const urlVar = options.cmdUrlEnvVarName ?? (await suggestedEnvVarName(ctx)).envVar;
  showSpinner(
    `Running '${options.cmd}' with environment variable "${urlVar}" set...${options.dryRun ? " [dry run]" : ""}`
  );
  if (!options.dryRun) {
    const canonicalCloudUrl = await fetchDeploymentCanonicalCloudUrl(ctx, {
      deploymentUrl: options.url,
      adminKey: options.adminKey
    });
    const env = { ...process.env };
    env[urlVar] = canonicalCloudUrl;
    const result = spawnSync(options.cmd, {
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
  logFinishedStep(
    `${options.dryRun ? "Would have run" : "Ran"} "${options.cmd}" with environment variable "${urlVar}" set`
  );
}
export async function fetchDeploymentCanonicalCloudUrl(ctx, options) {
  const result = await runSystemQuery(ctx, {
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
