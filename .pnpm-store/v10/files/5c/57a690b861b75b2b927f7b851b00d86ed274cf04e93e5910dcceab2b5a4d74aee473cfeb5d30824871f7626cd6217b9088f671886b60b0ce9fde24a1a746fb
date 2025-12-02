import chalk from "chalk";
import { deploymentDashboardUrlPage } from "./dashboard.js";
import { DeveloperIndexConfig } from "./deployApi/finishPush.js";

export type IndexMetadata = {
  table: string;
  name: string;
  fields:
    | string[]
    | {
        searchField: string;
        filterFields: string[];
      }
    | {
        dimensions: number;
        vectorField: string;
        filterFields: string[];
      };
  backfill: {
    state: "in_progress" | "done";
  };
  staged: boolean;
};

export type LargeIndexDeletionCheck =
  // Don’t verify whether large indexes have been deleted
  | "no verification"
  // If large indexes are being deleted, ask for confirmation (and fail in non-interactive envs)
  | "ask for confirmation"
  // If large indexes are being deleted, confirm (the user has used --allow-deleting-large-indexes)
  | "has confirmation";

export function addProgressLinkIfSlow(
  msg: string,
  deploymentName: string | null,
  start: number,
): string {
  if (Date.now() - start > 10_000) {
    const dashboardUrl = deploymentDashboardUrlPage(
      deploymentName,
      `/data?showSchema=true`,
    );
    msg = msg.concat(`\nSee progress here: ${dashboardUrl}`);
  }
  return msg;
}

export function formatIndex(index: DeveloperIndexConfig) {
  const [tableName, indexName] = index.name.split(".");
  return `${tableName}.${chalk.bold(indexName)} ${chalk.gray(formatIndexFields(index))}${index.staged ? chalk.blue("  (staged)") : ""}`;
}

function formatIndexFields(index: DeveloperIndexConfig) {
  switch (index.type) {
    case "database":
      return "  " + index.fields.map((f) => chalk.underline(f)).join(", ");
    case "search":
      return `${chalk.cyan("(text)")}   ${chalk.underline(index.searchField)}${formatFilterFields(index.filterFields)}`;
    case "vector":
      return `${chalk.cyan("(vector)")}   ${chalk.underline(index.vectorField)} (${index.dimensions} dimensions)${formatFilterFields(index.filterFields)}`;
    default:
      index satisfies never;
      return "";
  }
}

function formatFilterFields(filterFields: string[]) {
  if (filterFields.length === 0) {
    return "";
  }
  return `, filter${filterFields.length === 1 ? "" : "s"} on ${filterFields.map((f) => chalk.underline(f)).join(", ")}`;
}
