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
var functionSpec_exports = {};
__export(functionSpec_exports, {
  FunctionSpecTool: () => FunctionSpecTool
});
module.exports = __toCommonJS(functionSpec_exports);
var import_zod = require("zod");
var import_api = require("../../api.js");
var import_run = require("../../run.js");
var import_deploymentSelection = require("../../deploymentSelection.js");
const inputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe(
    "Deployment selector (from the status tool) to get function metadata from."
  )
});
const outputSchema = import_zod.z.any().describe("Function metadata including arguments and return values");
const description = `
Get the function metadata from a Convex deployment.

Returns an array of structured objects for each function the deployment. Each function's
metadata contains its identifier (which is its path within the convex/ folder joined
with its exported name), its argument validator, its return value validator, its type
(i.e. is it a query, mutation, or action), and its visibility (i.e. is it public or
internal).
`.trim();
const FunctionSpecTool = {
  name: "functionSpec",
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
    const functions = await (0, import_run.runSystemQuery)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/modules:apiSpec",
      componentPath: void 0,
      args: {}
    });
    return functions;
  }
};
//# sourceMappingURL=functionSpec.js.map
