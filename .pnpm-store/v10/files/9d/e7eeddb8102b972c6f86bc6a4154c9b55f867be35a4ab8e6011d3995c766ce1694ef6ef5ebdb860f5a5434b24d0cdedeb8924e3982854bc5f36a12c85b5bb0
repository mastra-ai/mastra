"use strict";
import chalk from "chalk";
import {
  changeSpinner,
  logFinishedStep,
  logMessage,
  stopSpinner
} from "../../bundler/log.js";
import { formatIndex } from "./indexes.js";
import { promptYesNo } from "./utils/prompts.js";
import { evaluatePush } from "./deploy2.js";
import { runSystemQuery } from "./run.js";
const MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING = 1e5;
export async function checkForLargeIndexDeletion({
  ctx,
  span,
  request,
  options,
  askForConfirmation
}) {
  changeSpinner("Verifying that the push isn\u2019t deleting large indexes...");
  const { schemaChange } = await evaluatePush(ctx, span, request, options);
  const indexDiffs = schemaChange.indexDiffs ?? {};
  const deletedIndexes = Object.entries(indexDiffs).flatMap(
    ([componentDefinitionPath, indexDiff]) => indexDiff.removed_indexes.map((index) => ({
      componentDefinitionPath,
      index
    }))
  );
  if (deletedIndexes.length === 0) {
    logFinishedStep("No indexes are deleted by this push");
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
  changeSpinner("Checking whether the deleted indexes are on large tables...");
  const documentCounts = await Promise.all(
    tablesWithDeletedIndexes.map(
      async ({ componentDefinitionPath, table }) => ({
        componentDefinitionPath,
        table,
        count: await runSystemQuery(ctx, {
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
    logFinishedStep("No large indexes are deleted by this push");
    return;
  }
  logMessage(`\u26A0\uFE0F  This code push will ${chalk.bold("delete")} the following ${deletedIndexesWithDocumentsCount.length === 1 ? "index" : "indexes"}
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
    logFinishedStep(
      "Proceeding with push since --allow-deleting-large-indexes is set"
    );
    return;
  }
  if (!process.stdin.isTTY) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `To confirm the push:
\u2022 run the deploy command in an ${chalk.bold("interactive terminal")}
\u2022 or run the deploy command with the ${chalk.bold("--allow-deleting-large-indexes")} flag`
    });
  }
  stopSpinner();
  if (!await promptYesNo(ctx, {
    message: `Delete these ${deletedIndexesWithDocumentsCount.length === 1 ? "index" : "indexes"}?`,
    default: false
  })) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Canceling push`
    });
  }
  logFinishedStep("Proceeding with push.");
}
function formatDeletedIndex({
  componentDefinitionPath,
  index,
  indexDiff,
  documentsCount,
  minDocumentsForWarning
}) {
  const componentNameFormatted = componentDefinitionPath !== "" ? `${chalk.gray(componentDefinitionPath)}:` : "";
  const documentsCountFormatted = documentsCount >= minDocumentsForWarning ? `  ${chalk.yellowBright(`\u26A0\uFE0F  ${documentsCount.toLocaleString()} documents`)}` : `  ${documentsCount.toLocaleString()} ${documentsCount === 1 ? "document" : "documents"}`;
  const replacedBy = indexDiff.added_indexes.find((i) => i.name === index.name);
  const replacedByFormatted = replacedBy ? `
   ${chalk.green("\u2192 replaced by:")} ${formatIndex(replacedBy)}` : "";
  return "\u26D4 " + componentNameFormatted + formatIndex(index) + documentsCountFormatted + replacedByFormatted;
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
