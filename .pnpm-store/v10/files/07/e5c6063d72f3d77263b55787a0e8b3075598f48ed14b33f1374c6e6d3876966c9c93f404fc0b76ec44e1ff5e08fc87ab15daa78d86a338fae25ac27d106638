"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var tables_exports = {};
__export(tables_exports, {
  TablesTool: () => TablesTool
});
module.exports = __toCommonJS(tables_exports);
var import_zod = require("zod");
var import_api = require("../../api.js");
var import_run = require("../../run.js");
var import_utils = require("../../utils/utils.js");
var import_deploymentSelection = require("../../deploymentSelection.js");
const inputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe(
    "Deployment selector (from the status tool) to read tables from."
  )
});
const outputSchema = import_zod.z.object({
  tables: import_zod.z.record(
    import_zod.z.string(),
    import_zod.z.object({
      schema: import_zod.z.any().optional(),
      inferredSchema: import_zod.z.any().optional()
    })
  )
});
const TablesTool = {
  name: "tables",
  description: "List all tables in a particular Convex deployment and their inferred and declared schema.",
  inputSchema,
  outputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector
    );
    process.chdir(projectDir);
    const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, ctx.options);
    const credentials = await (0, import_api.loadSelectedDeploymentCredentials)(
      ctx,
      deploymentSelection,
      deployment
    );
    const schemaResponse = await (0, import_run.runSystemQuery)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/frontend/getSchemas",
      componentPath: void 0,
      args: {}
    });
    const schema = {};
    if (schemaResponse.active) {
      const parsed = activeSchema.parse(JSON.parse(schemaResponse.active));
      for (const table of parsed.tables) {
        schema[table.tableName] = table;
      }
    }
    const fetch = (0, import_utils.deploymentFetch)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey
    });
    const response = await fetch("/api/shapes2", {});
    const shapesResult = await response.json();
    const allTablesSet = /* @__PURE__ */ new Set([
      ...Object.keys(shapesResult),
      ...Object.keys(schema)
    ]);
    const allTables = Array.from(allTablesSet);
    allTables.sort();
    const result = {};
    for (const table of allTables) {
      result[table] = {
        schema: schema[table],
        inferredSchema: shapesResult[table]
      };
    }
    return { tables: result };
  }
};
const activeSchemaEntry = import_zod.z.object({
  tableName: import_zod.z.string(),
  indexes: import_zod.z.array(import_zod.z.any()),
  searchIndexes: import_zod.z.array(import_zod.z.any()),
  vectorIndexes: import_zod.z.array(import_zod.z.any()),
  documentType: import_zod.z.any()
});
const activeSchema = import_zod.z.object({ tables: import_zod.z.array(activeSchemaEntry) });
//# sourceMappingURL=tables.js.map
