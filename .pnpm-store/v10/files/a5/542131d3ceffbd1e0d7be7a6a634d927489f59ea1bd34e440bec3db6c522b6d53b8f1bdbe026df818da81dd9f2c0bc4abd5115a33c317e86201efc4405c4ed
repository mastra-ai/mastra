"use strict";
import chalk from "chalk";
import {
  formatSize,
  waitUntilCalled,
  deploymentFetch,
  logAndHandleFetchError
} from "./utils/utils.js";
import {
  logFailure,
  showSpinner,
  logFinishedStep,
  logWarning,
  logMessage,
  stopSpinner,
  changeSpinner
} from "../../bundler/log.js";
import path from "path";
import { subscribe } from "./run.js";
import { ConvexHttpClient } from "../../browser/http_client.js";
import { makeFunctionReference } from "../../server/index.js";
import { promptYesNo } from "./utils/prompts.js";
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const ENV_CHUNK_SIZE = process.env.CONVEX_IMPORT_CHUNK_SIZE ? parseInt(process.env.CONVEX_IMPORT_CHUNK_SIZE, 10) : void 0;
export async function importIntoDeployment(ctx, filePath, options) {
  if (!ctx.fs.exists(filePath)) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Error: Path ${chalk.bold(filePath)} does not exist.`
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
  const convexClient = new ConvexHttpClient(options.deploymentUrl);
  convexClient.setAdminAuth(options.adminKey);
  const existingImports = await convexClient.query(
    makeFunctionReference(
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
  showSpinner(`Importing ${filePath} (${formatSize(fileStats.size)})`);
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
  const tableNotice = tableName ? ` to table "${chalk.bold(tableName)}"` : "";
  const onFailure = async () => {
    logFailure(
      `Importing data from "${chalk.bold(
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
  changeSpinner("Parsing uploaded data");
  const onProgress = (_ctx, state, checkpointCount) => {
    stopSpinner();
    while ((state.checkpoint_messages?.length ?? 0) > checkpointCount) {
      logFinishedStep(state.checkpoint_messages[checkpointCount]);
      checkpointCount += 1;
    }
    showSpinner(state.progress_message ?? "Importing");
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
        logFinishedStep(
          `Added ${snapshotImportState.num_rows_written} documents${tableNotice}${options.deploymentNotice}.`
        );
        return;
      case "failed":
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Importing data from "${chalk.bold(
            filePath
          )}"${tableNotice}${options.deploymentNotice} failed

${chalk.red(snapshotImportState.error_message)}`
        });
      case "waiting_for_confirmation": {
        stopSpinner();
        await askToConfirmImport(
          ctx,
          snapshotImportState.message_to_confirm,
          snapshotImportState.require_manual_confirmation,
          options.yes
        );
        showSpinner(`Importing`);
        await confirmImport(ctx, {
          importId,
          adminKey: options.adminKey,
          deploymentUrl: options.deploymentUrl,
          onError: async () => {
            logFailure(
              `Importing data from "${chalk.bold(
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
  logMessage(messageToConfirm);
  if (requireManualConfirmation !== false && !yes) {
    const confirmed = await promptYesNo(ctx, {
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
  logMessage(
    `There is already a snapshot import in progress.${atDashboardLink}`
  );
  if (yes) {
    return;
  }
  const confirmed = await promptYesNo(ctx, {
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
export async function waitForStableImportState(ctx, args) {
  const { importId, deploymentUrl, adminKey, onProgress } = args;
  const [donePromise, onDone] = waitUntilCalled();
  let snapshotImportState;
  let checkpointCount = 0;
  await subscribe(ctx, {
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
  const fileExtension = path.extname(filePath);
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
      logWarning(
        chalk.yellow(
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
export async function confirmImport(ctx, args) {
  const { importId, adminKey, deploymentUrl } = args;
  const fetch = deploymentFetch(ctx, {
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
    return await logAndHandleFetchError(ctx, e);
  }
}
export async function uploadForImport(ctx, args) {
  const { deploymentUrl, adminKey, filePath } = args;
  const fetch = deploymentFetch(ctx, {
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
  showSpinner(`Importing ${filePath} (${formatSize(fileStats.size)})`);
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
      changeSpinner(
        `Uploading ${filePath} (${formatSize(data.bytesRead)}/${formatSize(
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
    return await logAndHandleFetchError(ctx, e);
  }
  return importId;
}
function hasBomMarker(chunk) {
  return chunk.length >= 3 && chunk[0] === 239 && chunk[1] === 187 && chunk[2] === 191;
}
//# sourceMappingURL=convexImport.js.map
