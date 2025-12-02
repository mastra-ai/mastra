"use strict";
import chalk from "chalk";
import { deploymentDashboardUrlPage } from "./dashboard.js";
export function addProgressLinkIfSlow(msg, deploymentName, start) {
  if (Date.now() - start > 1e4) {
    const dashboardUrl = deploymentDashboardUrlPage(
      deploymentName,
      `/data?showSchema=true`
    );
    msg = msg.concat(`
See progress here: ${dashboardUrl}`);
  }
  return msg;
}
export function formatIndex(index) {
  const [tableName, indexName] = index.name.split(".");
  return `${tableName}.${chalk.bold(indexName)} ${chalk.gray(formatIndexFields(index))}${index.staged ? chalk.blue("  (staged)") : ""}`;
}
function formatIndexFields(index) {
  switch (index.type) {
    case "database":
      return "  " + index.fields.map((f) => chalk.underline(f)).join(", ");
    case "search":
      return `${chalk.cyan("(text)")}   ${chalk.underline(index.searchField)}${formatFilterFields(index.filterFields)}`;
    case "vector":
      return `${chalk.cyan("(vector)")}   ${chalk.underline(index.vectorField)} (${index.dimensions} dimensions)${formatFilterFields(index.filterFields)}`;
    default:
      index;
      return "";
  }
}
function formatFilterFields(filterFields) {
  if (filterFields.length === 0) {
    return "";
  }
  return `, filter${filterFields.length === 1 ? "" : "s"} on ${filterFields.map((f) => chalk.underline(f)).join(", ")}`;
}
//# sourceMappingURL=indexes.js.map
