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
var data_exports = {};
__export(data_exports, {
  DataTool: () => DataTool
});
module.exports = __toCommonJS(data_exports);
var import_zod = require("zod");
var import_run = require("../../run.js");
var import_api = require("../../api.js");
var import_deploymentSelection = require("../../deploymentSelection.js");
const inputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe("Deployment selector (from the status tool) to read data from."),
  tableName: import_zod.z.string().describe("The name of the table to read from."),
  order: import_zod.z.enum(["asc", "desc"]).describe("The order to sort the results in."),
  cursor: import_zod.z.string().optional().describe("The cursor to start reading from."),
  limit: import_zod.z.number().max(1e3).optional().describe("The maximum number of results to return, defaults to 100.")
});
const outputSchema = import_zod.z.object({
  page: import_zod.z.array(import_zod.z.any()),
  isDone: import_zod.z.boolean(),
  continueCursor: import_zod.z.string()
});
const description = `
Read a page of data from a table in the project's Convex deployment.

Output:
- page: A page of results from the table.
- isDone: Whether there are more results to read.
- continueCursor: The cursor to use to read the next page of results.
`.trim();
const DataTool = {
  name: "data",
  description,
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
    const paginationResult = await (0, import_run.runSystemQuery)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/tableData",
      componentPath: void 0,
      args: {
        table: args.tableName,
        order: args.order,
        paginationOpts: {
          numItems: args.limit ?? 100,
          cursor: args.cursor ?? null
        }
      }
    });
    return {
      page: paginationResult.page,
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.continueCursor
    };
  }
};
//# sourceMappingURL=data.js.map
