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
var convexImport_exports = {};
__export(convexImport_exports, {
  confirmImport: () => confirmImport,
  importIntoDeployment: () => importIntoDeployment,
  uploadForImport: () => uploadForImport,
  waitForStableImportState: () => waitForStableImportState
});
module.exports = __toCommonJS(convexImport_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_utils = require("./utils/utils.js");
var import_log = require("../../bundler/log.js");
var import_path = __toESM(require("path"), 1);
var import_run = require("./run.js");
var import_http_client = require("../../browser/http_client.js");
var import_server = require("../../server/index.js");
var import_prompts = require("./utils/prompts.js");
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const ENV_CHUNK_SIZE = process.env.CONVEX_IMPORT_CHUNK_SIZE ? parseInt(process.env.CONVEX_IMPORT_CHUNK_SIZE, 10) : void 0;
async function importIntoDeployment(ctx, filePath, options) {
  if (!ctx.fs.exists(filePath)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Error: Path ${import_chalk.default.bold(filePath)} does not exist.`
    });
  }
  const format = await determineFormat(ctx, filePath, options.format ?? null);
  const tableName = options.table ?? null;
  if (tableName === null) {
    if (format !== "zip") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: The \`--table\` option is required for format ${format}`
      });
    }
  } else {
    if (format === "zip") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error: The \`--table\` option is not allowed for format ${format}`
      });
    }
  }
  const convexClient = new import_http_client.ConvexHttpClient(options.deploymentUrl);
  convexClient.setAdminAuth(options.adminKey);
  const existingImports = await convexClient.query(
    (0, import_server.makeFunctionReference)(
      "_system/cli/queryImport:list"
    ),
    {}
  );
  const ongoingImports = existingImports.filter(
    (i) => i.state.state === "in_progress"
  );
  if (ongoingImports.length > 0) {
    await askToConfirmImportWithExistingImports(
      ctx,
      options.snapshotImportDashboardLink,
      options.yes
    );
  }
  const fileStats = ctx.fs.stat(filePath);
  (0, import_log.showSpinner)(`Importing ${filePath} (${(0, import_utils.formatSize)(fileStats.size)})`);
  let mode = "requireEmpty";
  if (options.append) {
    mode = "append";
  } else if (options.replace) {
    mode = "replace";
  } else if (options.replaceAll) {
    mode = "replaceAll";
  }
  const importArgs = {
    tableName: tableName === null ? void 0 : tableName,
    componentPath: options.component,
    mode,
    format
  };
  const tableNotice = tableName ? ` to table "${import_chalk.default.bold(tableName)}"` : "";
  const onFailure = async () => {
    (0, import_log.logFailure)(
      `Importing data from "${import_chalk.default.bold(
        filePath
      )}"${tableNotice}${options.deploymentNotice} failed`
    );
  };
  const importId = await uploadForImport(ctx, {
    deploymentUrl: options.deploymentUrl,
    adminKey: options.adminKey,
    filePath,
    importArgs,
    onImportFailed: onFailure
  });
  (0, import_log.changeSpinner)("Parsing uploaded data");
  const onProgress = (_ctx, state, checkpointCount) => {
    (0, import_log.stopSpinner)();
    while ((state.checkpoint_messages?.length ?? 0) > checkpointCount) {
      (0, import_log.logFinishedStep)(state.checkpoint_messages[checkpointCount]);
      checkpointCount += 1;
    }
    (0, import_log.showSpinner)(state.progress_message ?? "Importing");
    return checkpointCount;
  };
  while (true) {
    const snapshotImportState = await waitForStableImportState(ctx, {
      importId,
      deploymentUrl: options.deploymentUrl,
      adminKey: options.adminKey,
      onProgress
    });
    switch (snapshotImportState.state) {
      case "completed":
        (0, import_log.logFinishedStep)(
          `Added ${snapshotImportState.num_rows_written} documents${tableNotice}${options.deploymentNotice}.`
        );
        return;
      case "failed":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Importing data from "${import_chalk.default.bold(
            filePath
          )}"${tableNotice}${options.deploymentNotice} failed

${import_chalk.default.red(snapshotImportState.error_message)}`
        });
      case "waiting_for_confirmation": {
        (0, import_log.stopSpinner)();
        await askToConfirmImport(
          ctx,
          snapshotImportState.message_to_confirm,
          snapshotImportState.require_manual_confirmation,
          options.yes
        );
        (0, import_log.showSpinner)(`Importing`);
        await confirmImport(ctx, {
          importId,
          adminKey: options.adminKey,
          deploymentUrl: options.deploymentUrl,
          onError: async () => {
            (0, import_log.logFailure)(
              `Importing data from "${import_chalk.default.bold(
                filePath
              )}"${tableNotice}${options.deploymentNotice} failed`
            );
          }
        });
        break;
      }
      case "uploaded": {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Import canceled while parsing uploaded file`
        });
      }
      case "in_progress": {
        const visitDashboardLink = options.snapshotImportDashboardLink ? ` Visit ${options.snapshotImportDashboardLink} to monitor its progress.` : "";
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `WARNING: Import is continuing to run on the server.${visitDashboardLink}`
        });
      }
      default: {
        snapshotImportState;
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `unknown error: unexpected state ${snapshotImportState}`,
          errForSentry: `unexpected snapshot import state ${snapshotImportState.state}`
        });
      }
    }
  }
}
async function askToConfirmImport(ctx, messageToConfirm, requireManualConfirmation, yes) {
  if (!messageToConfirm?.length) {
    return;
  }
  (0, import_log.logMessage)(messageToConfirm);
  if (requireManualConfirmation !== false && !yes) {
    const confirmed = await (0, import_prompts.promptYesNo)(ctx, {
      message: "Perform import?",
      default: true
    });
    if (!confirmed) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Import canceled"
      });
    }
  }
}
async function askToConfirmImportWithExistingImports(ctx, snapshotImportDashboardLink, yes) {
  const atDashboardLink = snapshotImportDashboardLink ? ` You can view its progress at ${snapshotImportDashboardLink}.` : "";
  (0, import_log.logMessage)(
    `There is already a snapshot import in progress.${atDashboardLink}`
  );
  if (yes) {
    return;
  }
  const confirmed = await (0, import_prompts.promptYesNo)(ctx, {
    message: "Start another import?",
    default: true
  });
  if (!confirmed) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Import canceled"
    });
  }
}
async function waitForStableImportState(ctx, args) {
  const { importId, deploymentUrl, adminKey, onProgress } = args;
  const [donePromise, onDone] = (0, import_utils.waitUntilCalled)();
  let snapshotImportState;
  let checkpointCount = 0;
  await (0, import_run.subscribe)(ctx, {
    deploymentUrl,
    adminKey,
    parsedFunctionName: "_system/cli/queryImport",
    parsedFunctionArgs: { importId },
    componentPath: void 0,
    until: donePromise,
    callbacks: {
      onChange: (value) => {
        snapshotImportState = value.state;
        switch (snapshotImportState.state) {
          case "waiting_for_confirmation":
          case "completed":
          case "failed":
            onDone();
            break;
          case "uploaded":
            return;
          case "in_progress":
            checkpointCount = onProgress(
              ctx,
              snapshotImportState,
              checkpointCount
            );
            return;
        }
      }
    }
  });
  return snapshotImportState;
}
async function determineFormat(ctx, filePath, format) {
  const fileExtension = import_path.default.extname(filePath);
  if (fileExtension !== "") {
    const formatToExtension = {
      csv: ".csv",
      jsonLines: ".jsonl",
      jsonArray: ".json",
      zip: ".zip"
    };
    const extensionToFormat = Object.fromEntries(
      Object.entries(formatToExtension).map((a) => a.reverse())
    );
    if (format !== null && fileExtension !== formatToExtension[format]) {
      (0, import_log.logWarning)(
        import_chalk.default.yellow(
          `Warning: Extension of file ${filePath} (${fileExtension}) does not match specified format: ${format} (${formatToExtension[format]}).`
        )
      );
    }
    format ?? (format = extensionToFormat[fileExtension] ?? null);
  }
  if (format === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "No input file format inferred by the filename extension or specified. Specify your input file's format using the `--format` flag."
    });
  }
  return format;
}
async function confirmImport(ctx, args) {
  const { importId, adminKey, deploymentUrl } = args;
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl,
    adminKey
  });
  const performUrl = `/api/perform_import`;
  try {
    await fetch(performUrl, {
      method: "POST",
      body: JSON.stringify({ importId })
    });
  } catch (e) {
    await args.onError(e);
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
  }
}
async function uploadForImport(ctx, args) {
  const { deploymentUrl, adminKey, filePath } = args;
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl,
    adminKey
  });
  const fileStats = ctx.fs.stat(filePath);
  const minChunkSize = Math.ceil(fileStats.size / 9999);
  let chunkSize = ENV_CHUNK_SIZE ?? DEFAULT_CHUNK_SIZE;
  if (chunkSize < minChunkSize) {
    chunkSize = minChunkSize;
  }
  const data = ctx.fs.createReadStream(filePath, {
    highWaterMark: chunkSize
  });
  (0, import_log.showSpinner)(`Importing ${filePath} (${(0, import_utils.formatSize)(fileStats.size)})`);
  let importId;
  try {
    const startResp = await fetch("/api/import/start_upload", {
      method: "POST"
    });
    const { uploadToken } = await startResp.json();
    const partTokens = [];
    let partNumber = 1;
    for await (const chunk of data) {
      const chunkWithoutBom = partNumber === 1 && hasBomMarker(chunk) ? chunk.subarray(3) : chunk;
      const partUrl = `/api/import/upload_part?uploadToken=${encodeURIComponent(
        uploadToken
      )}&partNumber=${partNumber}`;
      const partResp = await fetch(partUrl, {
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body: chunkWithoutBom,
        method: "POST"
      });
      partTokens.push(await partResp.json());
      partNumber += 1;
      (0, import_log.changeSpinner)(
        `Uploading ${filePath} (${(0, import_utils.formatSize)(data.bytesRead)}/${(0, import_utils.formatSize)(
          fileStats.size
        )})`
      );
    }
    const finishResp = await fetch("/api/import/finish_upload", {
      body: JSON.stringify({
        import: args.importArgs,
        uploadToken,
        partTokens
      }),
      method: "POST"
    });
    const body = await finishResp.json();
    importId = body.importId;
  } catch (e) {
    await args.onImportFailed(e);
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
  }
  return importId;
}
function hasBomMarker(chunk) {
  return chunk.length >= 3 && chunk[0] === 239 && chunk[1] === 187 && chunk[2] === 191;
}
//# sourceMappingURL=convexImport.js.map
