"use strict";
import chalk from "chalk";
import { logError, logOutput, logWarning } from "../../bundler/log.js";
import { Base64 } from "../../values/index.js";
import { runSystemPaginatedQuery } from "./run.js";
export async function dataInDeployment(ctx, options) {
  if (options.tableName !== void 0) {
    await listDocuments(
      ctx,
      options.deploymentUrl,
      options.adminKey,
      options.tableName,
      {
        limit: options.limit,
        order: options.order,
        componentPath: options.component ?? "",
        format: options.format
      }
    );
  } else {
    await listTables(
      ctx,
      options.deploymentUrl,
      options.adminKey,
      options.deploymentNotice,
      options.component ?? ""
    );
  }
}
async function listTables(ctx, deploymentUrl, adminKey, deploymentNotice, componentPath) {
  const tables = await runSystemPaginatedQuery(ctx, {
    deploymentUrl,
    adminKey,
    functionName: "_system/cli/tables",
    componentPath,
    args: {}
  });
  if (tables.length === 0) {
    logError(`There are no tables in the ${deploymentNotice}database.`);
    return;
  }
  const tableNames = tables.map((table) => table.name);
  tableNames.sort();
  logOutput(tableNames.join("\n"));
}
async function listDocuments(ctx, deploymentUrl, adminKey, tableName, options) {
  const data = await runSystemPaginatedQuery(ctx, {
    deploymentUrl,
    adminKey,
    functionName: "_system/cli/tableData",
    componentPath: options.componentPath,
    args: {
      table: tableName,
      order: options.order ?? "desc"
    },
    limit: options.limit + 1
  });
  if (data.length === 0) {
    logError("There are no documents in this table.");
    return;
  }
  if (options.format === "json" || options.format === "jsonArray") {
    logOutput(
      "[\n" + data.slice(0, options.limit).map(stringify).join(",\n") + "\n]"
    );
  } else if (options.format === "jsonLines" || options.format === "jsonl") {
    logOutput(
      data.slice(0, options.limit).map((document) => stringify(document)).join("\n")
    );
  } else {
    logDocumentsTable(
      ctx,
      data.slice(0, options.limit).map((document) => {
        const printed = {};
        for (const key in document) {
          printed[key] = stringify(document[key]);
        }
        return printed;
      })
    );
    if (data.length > options.limit) {
      logWarning(
        chalk.yellow(
          `Showing the ${options.limit} ${options.order === "desc" ? "most recently" : "oldest"} created document${options.limit > 1 ? "s" : ""}. Use the --limit option to see more.`
        )
      );
    }
  }
}
function logDocumentsTable(_ctx, rows) {
  const columnsToWidths = {};
  for (const row of rows) {
    for (const column in row) {
      const value = row[column];
      columnsToWidths[column] = Math.max(
        value.length,
        columnsToWidths[column] ?? 0
      );
    }
  }
  const unsortedFields = Object.keys(columnsToWidths);
  unsortedFields.sort();
  const fields = Array.from(
    /* @__PURE__ */ new Set(["_id", "_creationTime", ...unsortedFields])
  );
  const columnWidths = fields.map((field) => columnsToWidths[field]);
  const lineLimit = process.stdout.isTTY ? process.stdout.columns : void 0;
  let didTruncate = false;
  function limitLine(line, limit) {
    if (limit === void 0) {
      return line;
    }
    const limitWithBufferForUnicode = limit - 10;
    if (line.length > limitWithBufferForUnicode) {
      didTruncate = true;
    }
    return line.slice(0, limitWithBufferForUnicode);
  }
  logOutput(
    limitLine(
      fields.map((field, i) => field.padEnd(columnWidths[i])).join(" | "),
      lineLimit
    )
  );
  logOutput(
    limitLine(
      columnWidths.map((width) => "-".repeat(width)).join("-|-"),
      lineLimit
    )
  );
  for (const row of rows) {
    logOutput(
      limitLine(
        fields.map((field, i) => (row[field] ?? "").padEnd(columnWidths[i])).join(" | "),
        lineLimit
      )
    );
  }
  if (didTruncate) {
    logWarning(
      chalk.yellow(
        "Lines were truncated to fit the terminal width. Pipe the command to see the full output, such as:\n  `npx convex data tableName | less -S`"
      )
    );
  }
}
function stringify(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value.toString();
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value instanceof ArrayBuffer) {
    const base64Encoded = Base64.fromByteArray(new Uint8Array(value));
    return `Bytes("${base64Encoded}")`;
  }
  if (value instanceof Array) {
    return `[${value.map(stringify).join(", ")}]`;
  }
  const pairs = Object.entries(value).map(([k, v]) => `"${k}": ${stringify(v)}`).join(", ");
  return `{ ${pairs} }`;
}
//# sourceMappingURL=data.js.map
