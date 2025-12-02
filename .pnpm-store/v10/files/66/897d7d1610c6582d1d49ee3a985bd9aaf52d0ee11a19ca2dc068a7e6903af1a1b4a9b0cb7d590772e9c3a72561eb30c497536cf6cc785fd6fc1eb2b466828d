import { Context } from "../../bundler/context.js";
import {
  changeSpinner,
  logError,
  logFailure,
  logFinishedStep,
  logVerbose,
  showSpinner,
} from "../../bundler/log.js";
import { spawnSync } from "child_process";
import { deploymentFetch, logAndHandleFetchError } from "./utils/utils.js";
import {
  EvaluatePushResponse,
  evaluatePushResponse,
  schemaStatus,
  SchemaStatus,
  StartPushRequest,
  startPushResponse,
  StartPushResponse,
} from "./deployApi/startPush.js";
import {
  AppDefinitionConfig,
  ComponentDefinitionConfig,
} from "./deployApi/definitionConfig.js";
import chalk from "chalk";
import { finishPushDiff, FinishPushDiff } from "./deployApi/finishPush.js";
import { Reporter, Span } from "./tracing.js";
import { promisify } from "node:util";
import zlib from "node:zlib";
import { PushOptions } from "./components.js";
import { runPush } from "./components.js";
import { suggestedEnvVarName } from "./envvars.js";
import { runSystemQuery } from "./run.js";
import { handlePushConfigError } from "./config.js";
import { deploymentDashboardUrlPage } from "./dashboard.js";
import { addProgressLinkIfSlow } from "./indexes.js";

const brotli = promisify(zlib.brotliCompress);

async function brotliCompress(ctx: Context, data: string): Promise<Buffer> {
  const start = performance.now();
  const result = await brotli(data, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
    },
  });
  const end = performance.now();
  const duration = end - start;
  logVerbose(
    `Compressed ${(data.length / 1024).toFixed(2)}KiB to ${(result.length / 1024).toFixed(2)}KiB (${((result.length / data.length) * 100).toFixed(2)}%) in ${duration.toFixed(2)}ms`,
  );
  return result;
}

/** Push configuration2 to the given remote origin. */
export async function startPush(
  ctx: Context,
  span: Span,
  request: StartPushRequest,
  options: {
    url: string;
    deploymentName: string | null;
  },
): Promise<StartPushResponse> {
  const response = await pushCode(
    ctx,
    span,
    request,
    options,
    "/api/deploy2/start_push",
  );
  return startPushResponse.parse(response);
}

export async function evaluatePush(
  ctx: Context,
  span: Span,
  request: StartPushRequest,
  options: {
    url: string;
    deploymentName: string | null;
  },
): Promise<EvaluatePushResponse> {
  const response = await pushCode(
    ctx,
    span,
    request,
    options,
    "/api/deploy2/evaluate_push",
  );
  return evaluatePushResponse.parse(response);
}

async function pushCode(
  ctx: Context,
  span: Span,
  request: StartPushRequest,
  options: {
    url: string;
    deploymentName: string | null;
  },
  endpoint: "/api/deploy2/start_push" | "/api/deploy2/evaluate_push",
): Promise<unknown> {
  const custom = (_k: string | number, s: any) =>
    typeof s === "string" ? s.slice(0, 40) + (s.length > 40 ? "..." : "") : s;
  logVerbose(JSON.stringify(request, custom, 2));
  const onError = (err: any) => {
    if (err.toString() === "TypeError: fetch failed") {
      changeSpinner(`Fetch failed, is ${options.url} correct? Retrying...`);
    }
  };
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: options.url,
    adminKey: request.adminKey,
    onError,
  });
  try {
    const response = await fetch(endpoint, {
      body: await brotliCompress(ctx, JSON.stringify(request)),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "br",
        traceparent: span.encodeW3CTraceparent(),
      },
    });
    return await response.json();
  } catch (error: unknown) {
    return await handlePushConfigError(
      ctx,
      error,
      "Error: Unable to start push to " + options.url,
      options.deploymentName,
      {
        adminKey: request.adminKey,
        deploymentUrl: options.url,
        deploymentNotice: "",
      },
    );
  }
}

// Long poll every 10s for progress on schema validation.
const SCHEMA_TIMEOUT_MS = 10_000;

export async function waitForSchema(
  ctx: Context,
  span: Span,
  startPush: StartPushResponse,
  options: {
    adminKey: string;
    url: string;
    dryRun: boolean;
    deploymentName: string | null;
  },
) {
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: options.url,
    adminKey: options.adminKey,
  });

  const start = Date.now();
  changeSpinner("Pushing code to your Convex deployment...");

  while (true) {
    let currentStatus: SchemaStatus;
    try {
      const response = await fetch("/api/deploy2/wait_for_schema", {
        body: JSON.stringify({
          adminKey: options.adminKey,
          schemaChange: startPush.schemaChange,
          timeoutMs: SCHEMA_TIMEOUT_MS,
          dryRun: options.dryRun,
        }),
        method: "POST",
        headers: {
          traceparent: span.encodeW3CTraceparent(),
        },
      });
      currentStatus = schemaStatus.parse(await response.json());
    } catch (error: unknown) {
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
        let msg: string;
        if (!indexesDone && !schemaDone) {
          msg = addProgressLinkIfSlow(
            `Backfilling indexes (${indexesComplete}/${indexesTotal} ready) and checking that documents match your schema...`,
            options.deploymentName,
            start,
          );
        } else if (!indexesDone) {
          msg = `Backfilling indexes (${indexesComplete}/${indexesTotal} ready)...`;
          // Set a more specific message if the backfill is taking a long time
          if (Date.now() - start > 10_000) {
            const rootDiff = startPush.schemaChange.indexDiffs?.[""];
            const indexName = (
              rootDiff?.added_indexes[0] || rootDiff?.enabled_indexes?.[0]
            )?.name;
            if (indexName) {
              const table = indexName.split(".")[0];
              const dashboardUrl = deploymentDashboardUrlPage(
                options.deploymentName,
                `/data?table=${table}&showIndexes=true`,
              );
              msg = `Backfilling index ${indexName} (${indexesComplete}/${indexesTotal} ready), see progress here: ${dashboardUrl}`;
            }
          }
        } else {
          msg = addProgressLinkIfSlow(
            "Checking that documents match your schema...",
            options.deploymentName,
            start,
          );
        }
        changeSpinner(msg);
        break;
      }
      case "failed": {
        // Schema validation failed. This could be either because the data
        // is bad or the schema is wrong. Classify this as a filesystem error
        // because adjusting `schema.ts` is the most normal next step.
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
            "invalid filesystem or db data": currentStatus.tableName
              ? {
                  tableName: currentStatus.tableName,
                  componentPath: currentStatus.componentPath,
                }
              : null,
          },
          printedMessage: null, // TODO - move logging into here
        });
      }
      case "raceDetected": {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Schema was overwritten by another push.`,
        });
      }
      case "complete": {
        changeSpinner("Schema validation complete.");
        return;
      }
    }
  }
}

export async function finishPush(
  ctx: Context,
  span: Span,
  startPush: StartPushResponse,
  options: {
    adminKey: string;
    url: string;
    dryRun: boolean;
    verbose?: boolean;
    deploymentName: string | null;
  },
): Promise<FinishPushDiff> {
  changeSpinner("Finalizing push...");
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: options.url,
    adminKey: options.adminKey,
  });
  const request = {
    adminKey: options.adminKey,
    startPush,
    dryRun: options.dryRun,
  };
  try {
    const response = await fetch("/api/deploy2/finish_push", {
      body: await brotliCompress(ctx, JSON.stringify(request)),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "br",
        traceparent: span.encodeW3CTraceparent(),
      },
    });
    return finishPushDiff.parse(await response.json());
  } catch (error: unknown) {
    return await handlePushConfigError(
      ctx,
      error,
      "Error: Unable to finish push to " + options.url,
      options.deploymentName,
      {
        adminKey: options.adminKey,
        deploymentUrl: options.url,
        deploymentNotice: "",
      },
    );
  }
}

export type ComponentDefinitionConfigWithoutImpls = Omit<
  ComponentDefinitionConfig,
  "schema" | "functions"
>;
export type AppDefinitionConfigWithoutImpls = Omit<
  AppDefinitionConfig,
  "schema" | "functions" | "auth"
>;

export async function reportPushCompleted(
  ctx: Context,
  adminKey: string,
  url: string,
  reporter: Reporter,
) {
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: url,
    adminKey,
  });
  try {
    const response = await fetch("/api/deploy2/report_push_completed", {
      body: JSON.stringify({
        adminKey,
        spans: reporter.spans,
      }),
      method: "POST",
    });
    await response.json();
  } catch (error: unknown) {
    logFailure(
      "Error: Unable to report push completed to " + url + ": " + error,
    );
  }
}

export async function deployToDeployment(
  ctx: Context,
  credentials: {
    url: string;
    adminKey: string;
    deploymentName: string | null;
  },
  options: {
    verbose?: boolean | undefined;
    dryRun?: boolean | undefined;
    yes?: boolean | undefined;
    typecheck: "enable" | "try" | "disable";
    typecheckComponents: boolean;
    codegen: "enable" | "disable";
    cmd?: string | undefined;
    cmdUrlEnvVarName?: string | undefined;

    debugBundlePath?: string | undefined;
    debug?: boolean | undefined;
    writePushRequest?: string | undefined;
    liveComponentSources?: boolean | undefined;
    allowDeletingLargeIndexes: boolean;
  },
) {
  const { url, adminKey } = credentials;
  await runCommand(ctx, { ...options, url, adminKey });

  const pushOptions: PushOptions = {
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
    largeIndexDeletionCheck: options.allowDeletingLargeIndexes
      ? "has confirmation"
      : "ask for confirmation",
  };
  showSpinner(`Deploying to ${url}...${options.dryRun ? " [dry run]" : ""}`);
  await runPush(ctx, pushOptions);
  logFinishedStep(
    `${
      options.dryRun ? "Would have deployed" : "Deployed"
    } Convex functions to ${url}`,
  );
}

export async function runCommand(
  ctx: Context,
  options: {
    cmdUrlEnvVarName?: string | undefined;
    cmd?: string | undefined;
    dryRun?: boolean | undefined;
    url: string;
    adminKey: string;
  },
) {
  if (options.cmd === undefined) {
    return;
  }

  const urlVar =
    options.cmdUrlEnvVarName ?? (await suggestedEnvVarName(ctx)).envVar;
  showSpinner(
    `Running '${options.cmd}' with environment variable "${urlVar}" set...${
      options.dryRun ? " [dry run]" : ""
    }`,
  );
  if (!options.dryRun) {
    const canonicalCloudUrl = await fetchDeploymentCanonicalCloudUrl(ctx, {
      deploymentUrl: options.url,
      adminKey: options.adminKey,
    });

    const env = { ...process.env };
    env[urlVar] = canonicalCloudUrl;
    const result = spawnSync(options.cmd, {
      env,
      stdio: "inherit",
      shell: true,
    });
    if (result.status !== 0) {
      await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `'${options.cmd}' failed`,
      });
    }
  }
  logFinishedStep(
    `${options.dryRun ? "Would have run" : "Ran"} "${
      options.cmd
    }" with environment variable "${urlVar}" set`,
  );
}

export async function fetchDeploymentCanonicalCloudUrl(
  ctx: Context,
  options: { deploymentUrl: string; adminKey: string },
): Promise<string> {
  const result = await runSystemQuery(ctx, {
    ...options,
    functionName: "_system/cli/convexUrl:cloudUrl",
    componentPath: undefined,
    args: {},
  });
  if (typeof result !== "string") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      printedMessage: "Invalid process.env.CONVEX_CLOUD_URL",
    });
  }
  return result;
}
