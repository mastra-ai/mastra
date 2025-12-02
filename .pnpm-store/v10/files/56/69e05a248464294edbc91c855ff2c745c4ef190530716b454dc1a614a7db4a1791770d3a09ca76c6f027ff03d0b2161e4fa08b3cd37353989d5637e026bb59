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
var data_exports = {};
__export(data_exports, {
  dataInDeployment: () => dataInDeployment
});
module.exports = __toCommonJS(data_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_values = require("../../values/index.js");
var import_run = require("./run.js");
async function dataInDeployment(ctx, options) {
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
  const tables = await (0, import_run.runSystemPaginatedQuery)(ctx, {
    deploymentUrl,
    adminKey,
    functionName: "_system/cli/tables",
    componentPath,
    args: {}
  });
  if (tables.length === 0) {
    (0, import_log.logError)(`There are no tables in the ${deploymentNotice}database.`);
    return;
  }
  const tableNames = tables.map((table) => table.name);
  tableNames.sort();
  (0, import_log.logOutput)(tableNames.join("\n"));
}
async function listDocuments(ctx, deploymentUrl, adminKey, tableName, options) {
  const data = await (0, import_run.runSystemPaginatedQuery)(ctx, {
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
    (0, import_log.logError)("There are no documents in this table.");
    return;
  }
  if (options.format === "json" || options.format === "jsonArray") {
    (0, import_log.logOutput)(
      "[\n" + data.slice(0, options.limit).map(stringify).join(",\n") + "\n]"
    );
  } else if (options.format === "jsonLines" || options.format === "jsonl") {
    (0, import_log.logOutput)(
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
      (0, import_log.logWarning)(
        import_chalk.default.yellow(
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
  (0, import_log.logOutput)(
    limitLine(
      fields.map((field, i) => field.padEnd(columnWidths[i])).join(" | "),
      lineLimit
    )
  );
  (0, import_log.logOutput)(
    limitLine(
      columnWidths.map((width) => "-".repeat(width)).join("-|-"),
      lineLimit
    )
  );
  for (const row of rows) {
    (0, import_log.logOutput)(
      limitLine(
        fields.map((field, i) => (row[field] ?? "").padEnd(columnWidths[i])).join(" | "),
        lineLimit
      )
    );
  }
  if (didTruncate) {
    (0, import_log.logWarning)(
      import_chalk.default.yellow(
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
    const base64Encoded = import_values.Base64.fromByteArray(new Uint8Array(value));
    return `Bytes("${base64Encoded}")`;
  }
  if (value instanceof Array) {
    return `[${value.map(stringify).join(", ")}]`;
  }
  const pairs = Object.entries(value).map(([k, v]) => `"${k}": ${stringify(v)}`).join(", ");
  return `{ ${pairs} }`;
}
//# sourceMappingURL=data.js.map
