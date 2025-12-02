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
  formatValue: () => formatValue,
  parseArgs: () => parseArgs,
  parseFunctionName: () => parseFunctionName,
  runFunctionAndLog: () => runFunctionAndLog,
  runInDeployment: () => runInDeployment,
  runSystemPaginatedQuery: () => runSystemPaginatedQuery,
  runSystemQuery: () => runSystemQuery,
  subscribe: () => subscribe,
  subscribeAndLog: () => subscribeAndLog
});
module.exports = __toCommonJS(run_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_util = __toESM(require("util"), 1);
var import_ws = __toESM(require("ws"), 1);
var import_http_client = require("../../browser/http_client.js");
var import_browser = require("../../browser/index.js");
var import_server = require("../../server/index.js");
var import_value = require("../../values/value.js");
var import_log = require("../../bundler/log.js");
var import_utils = require("./utils/utils.js");
var import_json5 = __toESM(require("json5"), 1);
var import_path = __toESM(require("path"), 1);
var import_config = require("./config.js");
var import_dev = require("./dev.js");
var import_logging = require("../../browser/logging.js");
async function runFunctionAndLog(ctx, args) {
  const client = new import_http_client.ConvexHttpClient(args.deploymentUrl, {
    logger: instantiateStderrLogger()
  });
  const identity = args.identityString ? await getFakeIdentity(ctx, args.identityString) : void 0;
  client.setAdminAuth(args.adminKey, identity);
  const functionArgs = await parseArgs(ctx, args.argsString);
  const { projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  const parsedFunctionName = await parseFunctionName(
    ctx,
    args.functionName,
    projectConfig.functions
  );
  let result;
  try {
    result = await client.function(
      (0, import_server.makeFunctionReference)(parsedFunctionName),
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
        return `\u2022 ${import_chalk.default.gray(`${path2}:`)}${name}`;
      });
      const availableFunctionsMessage = functionNames.length > 0 ? `Available functions:
${functionNames.join("\n")}` : "No functions found.";
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `Failed to run function "${args.functionName}":
${import_chalk.default.red(errorMessage)}

${availableFunctionsMessage}`
      });
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      printedMessage: `Failed to run function "${args.functionName}":
${import_chalk.default.red(errorMessage)}`
    });
  }
  args.callbacks?.onSuccess?.();
  if (result !== null) {
    (0, import_log.logOutput)(formatValue(result));
  }
}
async function getFakeIdentity(ctx, identityString) {
  let identity;
  try {
    identity = import_json5.default.parse(identityString);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to parse identity as JSON: "${identityString}"
${import_chalk.default.red(err.toString().trim())}`
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
async function parseArgs(ctx, argsString) {
  try {
    const argsJson = import_json5.default.parse(argsString);
    return (0, import_value.jsonToConvex)(argsJson);
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem or env vars",
      printedMessage: `Failed to parse arguments as JSON: "${argsString}"
${import_chalk.default.red(err.toString().trim())}`
    });
  }
}
async function parseFunctionName(ctx, functionName, functionDirName) {
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
    if (ctx.fs.exists(import_path.default.join(functionDirName, filePath))) {
      return normalizedName;
    } else {
      return functionNameWithoutPrefix;
    }
  } else {
    const exists = possibleExtensions.some(
      (extension) => ctx.fs.exists(import_path.default.join(functionDirName, filePath + extension))
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
async function runSystemPaginatedQuery(ctx, args) {
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
async function runSystemQuery(ctx, args) {
  let onResult;
  const resultPromise = new Promise((resolve) => {
    onResult = resolve;
  });
  const [donePromise, onDone] = (0, import_utils.waitUntilCalled)();
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
function formatValue(value) {
  const json = (0, import_value.convexToJson)(value);
  if (process.stdout.isTTY) {
    return import_util.default.inspect(value, { colors: true, depth: null });
  } else {
    return JSON.stringify(json, null, 2);
  }
}
async function subscribeAndLog(ctx, args) {
  const { projectConfig } = await (0, import_config.readProjectConfig)(ctx);
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
    until: (0, import_utils.waitForever)(),
    callbacks: {
      onStart() {
        (0, import_log.logFinishedStep)(
          `Watching query ${args.functionName} on ${args.deploymentUrl}...`
        );
      },
      onChange(result) {
        (0, import_log.logOutput)(formatValue(result));
      },
      onStop() {
        (0, import_log.logMessage)(`Closing connection to ${args.deploymentUrl}...`);
      }
    }
  });
}
async function subscribe(_ctx, args) {
  const client = new import_browser.BaseConvexClient(
    args.deploymentUrl,
    (updatedQueries) => {
      for (const queryToken of updatedQueries) {
        args.callbacks?.onChange?.(client.localQueryResultByToken(queryToken));
      }
    },
    {
      // pretend that a Node.js 'ws' library WebSocket is a browser WebSocket
      webSocketConstructor: import_ws.default,
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
  const [donePromise, onDone] = (0, import_utils.waitUntilCalled)();
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
async function runInDeployment(ctx, args) {
  if (args.push) {
    await (0, import_dev.watchAndPush)(
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
  const logger = new import_logging.DefaultLogger({ verbose: false });
  logger.addLogLineListener((_level, ...args) => {
    console.error(...args);
  });
  return logger;
}
//# sourceMappingURL=run.js.map
