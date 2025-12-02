import chalk from "chalk";
import { Context } from "../../bundler/context.js";
import {
  changeSpinner,
  logFinishedStep,
  logMessage,
  stopSpinner,
} from "../../bundler/log.js";
import { formatIndex } from "./indexes.js";
import { promptYesNo } from "./utils/prompts.js";
import { Span } from "./tracing.js";
import { StartPushRequest } from "./deployApi/startPush.js";
import { evaluatePush } from "./deploy2.js";
import { DeveloperIndexConfig, IndexDiff } from "./deployApi/finishPush.js";
import { runSystemQuery } from "./run.js";

const MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING = 100_000;

export async function checkForLargeIndexDeletion({
  ctx,
  span,
  request,
  options,
  askForConfirmation,
}: {
  ctx: Context;
  span: Span;
  request: StartPushRequest;
  options: {
    url: string;
    deploymentName: string | null;
    adminKey: string;
  };
  askForConfirmation: boolean;
}): Promise<void> {
  changeSpinner("Verifying that the push isn’t deleting large indexes...");

  const { schemaChange } = await evaluatePush(ctx, span, request, options);

  const indexDiffs = schemaChange.indexDiffs ?? {};
  const deletedIndexes = Object.entries(indexDiffs).flatMap(
    ([componentDefinitionPath, indexDiff]) =>
      indexDiff.removed_indexes.map((index) => ({
        componentDefinitionPath,
        index,
      })),
  );

  if (deletedIndexes.length === 0) {
    logFinishedStep("No indexes are deleted by this push");
    return;
  }

  const tablesWithDeletedIndexes = [
    ...new Set(
      deletedIndexes.map(
        ({ componentDefinitionPath, index }) =>
          `${componentDefinitionPath}:${getTableName(index)}`,
      ),
    ),
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
        count: (await runSystemQuery(ctx, {
          deploymentUrl: options.url,
          adminKey: options.adminKey,
          functionName: "_system/cli/tableSize:default",
          componentPath: componentDefinitionPath,
          args: { tableName: table },
        })) as number,
      }),
    ),
  );
  const deletedIndexesWithDocumentsCount = deletedIndexes.map(
    ({ componentDefinitionPath, index }) => ({
      componentDefinitionPath,
      index,
      count: documentCounts.find(
        (count) =>
          count.table === getTableName(index) &&
          count.componentDefinitionPath === componentDefinitionPath,
      )!.count,
    }),
  );

  const minDocumentsForWarning = minDocumentsForIndexDeleteWarning();
  if (
    !deletedIndexesWithDocumentsCount.some(
      ({ count }) => count >= minDocumentsForWarning,
    )
  ) {
    logFinishedStep("No large indexes are deleted by this push");
    return;
  }

  logMessage(`⚠️  This code push will ${chalk.bold("delete")} the following ${deletedIndexesWithDocumentsCount.length === 1 ? "index" : "indexes"}
from your production deployment (${options.url}):

${deletedIndexesWithDocumentsCount
  .map(({ componentDefinitionPath, index, count }) =>
    formatDeletedIndex({
      componentDefinitionPath,
      index,
      indexDiff: indexDiffs[componentDefinitionPath],
      documentsCount: count,
      minDocumentsForWarning,
    }),
  )
  .join("\n")}

The documents that are in the index won’t be deleted, but the index will need
to be backfilled again if you want to restore it later.
`);

  if (!askForConfirmation) {
    logFinishedStep(
      "Proceeding with push since --allow-deleting-large-indexes is set",
    );
    return;
  }

  if (!process.stdin.isTTY) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `To confirm the push:
• run the deploy command in an ${chalk.bold("interactive terminal")}
• or run the deploy command with the ${chalk.bold("--allow-deleting-large-indexes")} flag`,
    });
  }

  stopSpinner();
  if (
    !(await promptYesNo(ctx, {
      message: `Delete these ${deletedIndexesWithDocumentsCount.length === 1 ? "index" : "indexes"}?`,
      default: false,
    }))
  ) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Canceling push`,
    });
  }

  logFinishedStep("Proceeding with push.");
}

function formatDeletedIndex({
  componentDefinitionPath,
  index,
  indexDiff,
  documentsCount,
  minDocumentsForWarning,
}: {
  componentDefinitionPath: string;
  index: DeveloperIndexConfig;
  indexDiff: IndexDiff;
  documentsCount: number;
  minDocumentsForWarning: number;
}) {
  const componentNameFormatted =
    componentDefinitionPath !== ""
      ? `${chalk.gray(componentDefinitionPath)}:`
      : "";

  const documentsCountFormatted =
    documentsCount >= minDocumentsForWarning
      ? `  ${chalk.yellowBright(`⚠️  ${documentsCount.toLocaleString()} documents`)}`
      : `  ${documentsCount.toLocaleString()} ${documentsCount === 1 ? "document" : "documents"}`;

  const replacedBy = indexDiff.added_indexes.find((i) => i.name === index.name);
  const replacedByFormatted = replacedBy
    ? `\n   ${chalk.green("→ replaced by:")} ${formatIndex(replacedBy)}`
    : "";

  return (
    "⛔ " +
    componentNameFormatted +
    formatIndex(index) +
    documentsCountFormatted +
    replacedByFormatted
  );
}

function getTableName(index: DeveloperIndexConfig) {
  const [tableName, _indexName] = index.name.split(".");
  return tableName;
}

function minDocumentsForIndexDeleteWarning(): number {
  const envValue = process.env.CONVEX_MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING;
  if (envValue !== undefined) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return MIN_DOCUMENTS_FOR_INDEX_DELETE_WARNING;
}
