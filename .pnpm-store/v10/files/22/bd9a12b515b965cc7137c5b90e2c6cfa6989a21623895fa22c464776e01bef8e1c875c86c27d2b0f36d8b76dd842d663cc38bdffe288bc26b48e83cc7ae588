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
var convexExport_exports = {};
__export(convexExport_exports, {
  downloadSnapshotExport: () => downloadSnapshotExport,
  exportFromDeployment: () => exportFromDeployment,
  startSnapshotExport: () => startSnapshotExport
});
module.exports = __toCommonJS(convexExport_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_utils = require("./utils/utils.js");
var import_log = require("../../bundler/log.js");
var import_run = require("./run.js");
var import_fs = require("../../bundler/fs.js");
var import_path = __toESM(require("path"), 1);
var import_stream = require("stream");
var import_value = require("../../values/value.js");
async function exportFromDeployment(ctx, options) {
  const includeStorage = !!options.includeFileStorage;
  const {
    deploymentUrl,
    adminKey,
    path: inputPath,
    deploymentNotice,
    snapshotExportDashboardLink
  } = options;
  (0, import_log.showSpinner)(`Creating snapshot export${deploymentNotice}`);
  const snapshotExportState = await startSnapshotExport(ctx, {
    includeStorage,
    inputPath,
    adminKey,
    deploymentUrl
  });
  switch (snapshotExportState.state) {
    case "completed":
      (0, import_log.stopSpinner)();
      (0, import_log.logFinishedStep)(
        `Created snapshot export at timestamp ${snapshotExportState.start_ts}`
      );
      if (snapshotExportDashboardLink !== void 0) {
        (0, import_log.logFinishedStep)(
          `Export is available at ${snapshotExportDashboardLink}`
        );
      }
      break;
    case "requested":
    case "in_progress": {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `WARNING: Export is continuing to run on the server.`
      });
    }
    case "failed": {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Export failed. Please try again later or contact support@convex.dev for help.`
      });
    }
    default: {
      snapshotExportState;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `unknown error: unexpected state ${(0, import_value.stringifyValueForError)(snapshotExportState)}`,
        errForSentry: `unexpected snapshot export state ${snapshotExportState.state}`
      });
    }
  }
  (0, import_log.showSpinner)(`Downloading snapshot export to ${import_chalk.default.bold(inputPath)}`);
  const { filePath } = await downloadSnapshotExport(ctx, {
    snapshotExportTs: snapshotExportState.start_ts,
    inputPath,
    adminKey,
    deploymentUrl
  });
  (0, import_log.stopSpinner)();
  (0, import_log.logFinishedStep)(`Downloaded snapshot export to ${import_chalk.default.bold(filePath)}`);
}
async function waitForStableExportState(ctx, deploymentUrl, adminKey) {
  const [donePromise, onDone] = (0, import_utils.waitUntilCalled)();
  let snapshotExportState;
  await (0, import_run.subscribe)(ctx, {
    deploymentUrl,
    adminKey,
    parsedFunctionName: "_system/cli/exports:getLatest",
    parsedFunctionArgs: {},
    componentPath: void 0,
    until: donePromise,
    callbacks: {
      onChange: (value) => {
        snapshotExportState = value;
        switch (snapshotExportState.state) {
          case "requested":
          case "in_progress":
            break;
          case "completed":
          case "failed":
            onDone();
            break;
          default: {
            snapshotExportState;
            onDone();
          }
        }
      }
    }
  });
  return snapshotExportState;
}
async function startSnapshotExport(ctx, args) {
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey
  });
  try {
    await fetch(
      `/api/export/request/zip?includeStorage=${args.includeStorage}`,
      {
        method: "POST"
      }
    );
  } catch (e) {
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
  }
  const snapshotExportState = await waitForStableExportState(
    ctx,
    args.deploymentUrl,
    args.adminKey
  );
  return snapshotExportState;
}
async function downloadSnapshotExport(ctx, args) {
  const inputPath = args.inputPath;
  const exportUrl = `/api/export/zip/${args.snapshotExportTs.toString()}`;
  const fetch = (0, import_utils.deploymentFetch)(ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey
  });
  let response;
  try {
    response = await fetch(exportUrl, {
      method: "GET"
    });
  } catch (e) {
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
  }
  let filePath;
  if (ctx.fs.exists(inputPath)) {
    const st = ctx.fs.stat(inputPath);
    if (st.isDirectory()) {
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      let filename = `snapshot_${args.snapshotExportTs.toString()}.zip`;
      if (contentDisposition.startsWith("attachment; filename=")) {
        filename = contentDisposition.slice("attachment; filename=".length);
      }
      filePath = import_path.default.join(inputPath, filename);
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `Error: Path ${import_chalk.default.bold(inputPath)} already exists.`
      });
    }
  } else {
    filePath = inputPath;
  }
  (0, import_log.changeSpinner)(`Downloading snapshot export to ${import_chalk.default.bold(filePath)}`);
  try {
    await import_fs.nodeFs.writeFileStream(
      filePath,
      import_stream.Readable.fromWeb(response.body)
    );
  } catch (e) {
    (0, import_log.logFailure)(`Exporting data failed`);
    (0, import_log.logError)(import_chalk.default.red(e));
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Exporting data failed: ${import_chalk.default.red(e)}`
    });
  }
  return { filePath };
}
//# sourceMappingURL=convexExport.js.map
