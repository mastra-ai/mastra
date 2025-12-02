"use strict";
import chalk from "chalk";
import util from "util";
import ws from "ws";
import { ConvexHttpClient } from "../../browser/http_client.js";
import { BaseConvexClient } from "../../browser/index.js";
import {
  makeFunctionReference
} from "../../server/index.js";
import { convexToJson, jsonToConvex } from "../../values/value.js";
import { logFinishedStep, logMessage, logOutput } from "../../bundler/log.js";
import { waitForever, waitUntilCalled } from "./utils/utils.js";
import JSON5 from "json5";
import path from "path";
import { readProjectConfig } from "./config.js";
import { watchAndPush } from "./dev.js";
import { DefaultLogger } from "../../browser/logging.js";
export async function runFunctionAndLog(ctx, args) {
  const client = new ConvexHttpClient(args.deploymentUrl, {
    logger: instantiateStderrLogger()
  });
  const identity = args.identityString ? await getFakeIdentity(ctx, args.identityString) : void 0;
  client.setAdminAuth(args.adminKey, identity);
  const functionArgs = await parseArgs(ctx, args.argsString);
  const { projectConfig } = await readProjectConfig(ctx);
  const parsedFunctionName = await parseFunctionName(
    ctx,
    args.functionName,
    projectConfig.functions
  );
  let result;
  try {
    result = await client.function(
      makeFunctionReference(parsedFunctionName),
      args.componentPath,
      functionArgs
    );
  } catch (err) {
    const errorMessage = err.toString().trim();
    if (errorMessage.includes("Could not find function")) {
      const functions = await runSystemQuery(ctx, {
        deploymentUrl: args.deploymentUrl,
        adminKey: args.adminKey,
        functionName: "_system/cli/modules:apiSpec",
        componentPath: args.componentPath,
        args: {}
      });
      const functionNames = functions.filter(
        (fn) => fn.functionType !== "HttpAction"
      ).map(({ identifier }) => {
        const separatorPos = identifier.indexOf(":");
        const path2 = separatorPos === -1 ? "" : identifier.substring(0, separatorPos).replace(/\.js$/, "");
        const name = separatorPos === -1 ? identifier : identifier.substring(separatorPos + 1);
        return `\u2022 ${chalk.gray(`${path2}:`)}${name}`;
      });
      const availableFunctionsMessage = functionNames.length > 0 ? `Available functions:
${functionNames.join("\n")}` : "No functions found.";
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `Failed to run function "${args.functionName}":
${chalk.red(errorMessage)}

${availableFunctionsMessage}`
      });
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      printedMessage: `Failed to run function "${args.functionName}":
${chalk.red(errorMessage)}`
    });
  }
  args.callbacks?.onSuccess?.();
  if (result !== null) {
    logOutput(formatValue(result));
  }
}
async function getFakeIdentity(ctx, identityString) {
  let identity;
  try {
    identity = JSON5.parse(identityString);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to parse identity as JSON: "${identityString}"
${chalk.red(err.toString().trim())}`
    });
  }
  const subject = identity.subject ?? "" + simpleHash(JSON.stringify(identity));
  const issuer = identity.issuer ?? "https://convex.test";
  const tokenIdentifier = identity.tokenIdentifier ?? `${issuer.toString()}|${subject.toString()}`;
  return {
    ...identity,
    subject,
    issuer,
    tokenIdentifier
  };
}
export async function parseArgs(ctx, argsString) {
  try {
    const argsJson = JSON5.parse(argsString);
    return jsonToConvex(argsJson);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      printedMessage: `Failed to parse arguments as JSON: "${argsString}"
${chalk.red(err.toString().trim())}`
    });
  }
}
export async function parseFunctionName(ctx, functionName, functionDirName) {
  if (functionName.startsWith("api.") || functionName.startsWith("internal.")) {
    const parts = functionName.split(".");
    if (parts.length < 3) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Function name has too few parts: "${functionName}"`
      });
    }
    const exportName2 = parts.pop();
    const parsedName = `${parts.slice(1).join("/")}:${exportName2}`;
    return parsedName;
  }
  const filePath = functionName.split(":")[0];
  const possibleExtensions = [
    ".ts",
    ".js",
    ".tsx",
    ".jsx",
    ".mts",
    ".mjs",
    ".cts",
    ".cjs"
  ];
  let hasExtension = false;
  let normalizedFilePath = filePath;
  for (const extension of possibleExtensions) {
    if (filePath.endsWith(extension)) {
      normalizedFilePath = filePath.slice(0, -extension.length);
      hasExtension = true;
      break;
    }
  }
  const exportName = functionName.split(":")[1] ?? "default";
  const normalizedName = `${normalizedFilePath}:${exportName}`;
  if (!filePath.startsWith(functionDirName)) {
    return normalizedName;
  }
  const filePathWithoutPrefix = normalizedFilePath.slice(
    functionDirName.length
  );
  const functionNameWithoutPrefix = `${filePathWithoutPrefix}:${exportName}`;
  if (hasExtension) {
    if (ctx.fs.exists(path.join(functionDirName, filePath))) {
      return normalizedName;
    } else {
      return functionNameWithoutPrefix;
    }
  } else {
    const exists = possibleExtensions.some(
      (extension) => ctx.fs.exists(path.join(functionDirName, filePath + extension))
    );
    if (exists) {
      return normalizedName;
    } else {
      return functionNameWithoutPrefix;
    }
  }
}
function simpleHash(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}
export async function runSystemPaginatedQuery(ctx, args) {
  const results = [];
  let cursor = null;
  let isDone = false;
  while (!isDone && (args.limit === void 0 || results.length < args.limit)) {
    const paginationResult = await runSystemQuery(ctx, {
      ...args,
      args: {
        ...args.args,
        paginationOpts: {
          cursor,
          numItems: args.limit === void 0 ? 1e4 : args.limit - results.length
        }
      }
    });
    isDone = paginationResult.isDone;
    cursor = paginationResult.continueCursor;
    results.push(...paginationResult.page);
  }
  return results;
}
export async function runSystemQuery(ctx, args) {
  let onResult;
  const resultPromise = new Promise((resolve) => {
    onResult = resolve;
  });
  const [donePromise, onDone] = waitUntilCalled();
  await subscribe(ctx, {
    ...args,
    parsedFunctionName: args.functionName,
    parsedFunctionArgs: args.args,
    until: donePromise,
    callbacks: {
      onChange: (result) => {
        onDone();
        onResult(result);
      }
    }
  });
  return resultPromise;
}
export function formatValue(value) {
  const json = convexToJson(value);
  if (process.stdout.isTTY) {
    return util.inspect(value, { colors: true, depth: null });
  } else {
    return JSON.stringify(json, null, 2);
  }
}
export async function subscribeAndLog(ctx, args) {
  const { projectConfig } = await readProjectConfig(ctx);
  const parsedFunctionName = await parseFunctionName(
    ctx,
    args.functionName,
    projectConfig.functions
  );
  const identity = args.identityString ? await getFakeIdentity(ctx, args.identityString) : void 0;
  const functionArgs = await parseArgs(ctx, args.argsString);
  return subscribe(ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey,
    identity,
    parsedFunctionName,
    parsedFunctionArgs: functionArgs,
    componentPath: args.componentPath,
    until: waitForever(),
    callbacks: {
      onStart() {
        logFinishedStep(
          `Watching query ${args.functionName} on ${args.deploymentUrl}...`
        );
      },
      onChange(result) {
        logOutput(formatValue(result));
      },
      onStop() {
        logMessage(`Closing connection to ${args.deploymentUrl}...`);
      }
    }
  });
}
export async function subscribe(_ctx, args) {
  const client = new BaseConvexClient(
    args.deploymentUrl,
    (updatedQueries) => {
      for (const queryToken of updatedQueries) {
        args.callbacks?.onChange?.(client.localQueryResultByToken(queryToken));
      }
    },
    {
      // pretend that a Node.js 'ws' library WebSocket is a browser WebSocket
      webSocketConstructor: ws,
      unsavedChangesWarning: false
    }
  );
  client.setAdminAuth(args.adminKey, args.identity);
  const { unsubscribe } = client.subscribe(
    args.parsedFunctionName,
    args.parsedFunctionArgs,
    {
      componentPath: args.componentPath
    }
  );
  args.callbacks?.onStart?.();
  let done = false;
  const [donePromise, onDone] = waitUntilCalled();
  const stopWatching = () => {
    if (done) {
      return;
    }
    done = true;
    unsubscribe();
    void client.close();
    process.off("SIGINT", sigintListener);
    onDone();
    args.callbacks?.onStop?.();
  };
  function sigintListener() {
    stopWatching();
  }
  process.on("SIGINT", sigintListener);
  void args.until.finally(stopWatching);
  while (!done) {
    const oneDay = 24 * 60 * 60 * 1e3;
    await Promise.race([
      donePromise,
      new Promise((resolve) => setTimeout(resolve, oneDay))
    ]);
  }
}
export async function runInDeployment(ctx, args) {
  if (args.push) {
    await watchAndPush(
      ctx,
      {
        url: args.deploymentUrl,
        adminKey: args.adminKey,
        deploymentName: args.deploymentName,
        verbose: false,
        dryRun: false,
        typecheck: args.typecheck,
        typecheckComponents: args.typecheckComponents,
        debug: false,
        debugNodeApis: false,
        codegen: args.codegen,
        liveComponentSources: args.liveComponentSources,
        largeIndexDeletionCheck: "no verification"
        // `convex run` can’t push to prod
      },
      {
        once: true,
        traceEvents: false,
        untilSuccess: true
      }
    );
  }
  if (args.watch) {
    return await subscribeAndLog(ctx, args);
  }
  return await runFunctionAndLog(ctx, args);
}
function instantiateStderrLogger() {
  const logger = new DefaultLogger({ verbose: false });
  logger.addLogLineListener((_level, ...args) => {
    console.error(...args);
  });
  return logger;
}
//# sourceMappingURL=run.js.map
