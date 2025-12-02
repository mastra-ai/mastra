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
var checkForLargeIndexDeletion_exports = {};
__export(checkForLargeIndexDeletion_exports, {
  checkForLargeIndexDeletion: () => checkForLargeIndexDeletion
});
module.exports = __toCommonJS(checkForLargeIndexDeletion_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_indexes = require("./indexes.js");
var import_prompts = require("./utils/prompts.js");
var import_deploy2 = require("./deploy2.js");
var import_run = require("./run.js");
const MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING = 1e5;
async function checkForLargeIndexDeletion({
  ctx,
  span,
  request,
  options,
  askForConfirmation
}) {
  (0, import_log.changeSpinner)("Verifying that the push isn\u2019t deleting large indexes...");
  const { schemaChange } = await (0, import_deploy2.evaluatePush)(ctx, span, request, options);
  const indexDiffs = schemaChange.indexDiffs ?? {};
  const deletedIndexes = Object.entries(indexDiffs).flatMap(
    ([componentDefinitionPath, indexDiff]) => indexDiff.removed_indexes.map((index) => ({
      componentDefinitionPath,
      index
    }))
  );
  if (deletedIndexes.length === 0) {
    (0, import_log.logFinishedStep)("No indexes are deleted by this push");
    return;
  }
  const tablesWithDeletedIndexes = [
    ...new Set(
      deletedIndexes.map(
        ({ componentDefinitionPath, index }) => `${componentDefinitionPath}:${getTableName(index)}`
      )
    )
  ].map((str) => {
    const [componentDefinitionPath, table] = str.split(":");
    return { componentDefinitionPath, table };
  });
  (0, import_log.changeSpinner)("Checking whether the deleted indexes are on large tables...");
  const documentCounts = await Promise.all(
    tablesWithDeletedIndexes.map(
      async ({ componentDefinitionPath, table }) => ({
        componentDefinitionPath,
        table,
        count: await (0, import_run.runSystemQuery)(ctx, {
          deploymentUrl: options.url,
          adminKey: options.adminKey,
          functionName: "_system/cli/tableSize:default",
          componentPath: componentDefinitionPath,
          args: { tableName: table }
        })
      })
    )
  );
  const deletedIndexesWithDocumentsCount = deletedIndexes.map(
    ({ componentDefinitionPath, index }) => ({
      componentDefinitionPath,
      index,
      count: documentCounts.find(
        (count) => count.table === getTableName(index) && count.componentDefinitionPath === componentDefinitionPath
      ).count
    })
  );
  const minDocumentsForWarning = minDocumentsForIndexDeleteWarning();
  if (!deletedIndexesWithDocumentsCount.some(
    ({ count }) => count >= minDocumentsForWarning
  )) {
    (0, import_log.logFinishedStep)("No large indexes are deleted by this push");
    return;
  }
  (0, import_log.logMessage)(`\u26A0\uFE0F  This code push will ${import_chalk.default.bold("delete")} the following ${deletedIndexesWithDocumentsCount.length === 1 ? "index" : "indexes"}
from your production deployment (${options.url}):

${deletedIndexesWithDocumentsCount.map(
    ({ componentDefinitionPath, index, count }) => formatDeletedIndex({
      componentDefinitionPath,
      index,
      indexDiff: indexDiffs[componentDefinitionPath],
      documentsCount: count,
      minDocumentsForWarning
    })
  ).join("\n")}

The documents that are in the index won\u2019t be deleted, but the index will need
to be backfilled again if you want to restore it later.
`);
  if (!askForConfirmation) {
    (0, import_log.logFinishedStep)(
      "Proceeding with push since --allow-deleting-large-indexes is set"
    );
    return;
  }
  if (!process.stdin.isTTY) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `To confirm the push:
\u2022 run the deploy command in an ${import_chalk.default.bold("interactive terminal")}
\u2022 or run the deploy command with the ${import_chalk.default.bold("--allow-deleting-large-indexes")} flag`
    });
  }
  (0, import_log.stopSpinner)();
  if (!await (0, import_prompts.promptYesNo)(ctx, {
    message: `Delete these ${deletedIndexesWithDocumentsCount.length === 1 ? "index" : "indexes"}?`,
    default: false
  })) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Canceling push`
    });
  }
  (0, import_log.logFinishedStep)("Proceeding with push.");
}
function formatDeletedIndex({
  componentDefinitionPath,
  index,
  indexDiff,
  documentsCount,
  minDocumentsForWarning
}) {
  const componentNameFormatted = componentDefinitionPath !== "" ? `${import_chalk.default.gray(componentDefinitionPath)}:` : "";
  const documentsCountFormatted = documentsCount >= minDocumentsForWarning ? `  ${import_chalk.default.yellowBright(`\u26A0\uFE0F  ${documentsCount.toLocaleString()} documents`)}` : `  ${documentsCount.toLocaleString()} ${documentsCount === 1 ? "document" : "documents"}`;
  const replacedBy = indexDiff.added_indexes.find((i) => i.name === index.name);
  const replacedByFormatted = replacedBy ? `
   ${import_chalk.default.green("\u2192 replaced by:")} ${(0, import_indexes.formatIndex)(replacedBy)}` : "";
  return "\u26D4 " + componentNameFormatted + (0, import_indexes.formatIndex)(index) + documentsCountFormatted + replacedByFormatted;
}
function getTableName(index) {
  const [tableName, _indexName] = index.name.split(".");
  return tableName;
}
function minDocumentsForIndexDeleteWarning() {
  const envValue = process.env.CONVEX_MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING;
  if (envValue !== void 0) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING;
}
//# sourceMappingURL=checkForLargeIndexDeletion.js.map
