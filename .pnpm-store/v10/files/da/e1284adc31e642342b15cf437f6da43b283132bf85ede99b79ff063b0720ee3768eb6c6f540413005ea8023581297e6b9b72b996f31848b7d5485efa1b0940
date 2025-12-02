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
var env_exports = {};
__export(env_exports, {
  EnvGetTool: () => EnvGetTool,
  EnvListTool: () => EnvListTool,
  EnvRemoveTool: () => EnvRemoveTool,
  EnvSetTool: () => EnvSetTool
});
module.exports = __toCommonJS(env_exports);
var import_zod = require("zod");
var import_api = require("../../api.js");
var import_env = require("../../env.js");
var import_run = require("../../run.js");
var import_deploymentSelection = require("../../deploymentSelection.js");
const envListInputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe(
    "Deployment selector (from the status tool) to list environment variables from."
  )
});
const envListOutputSchema = import_zod.z.object({
  variables: import_zod.z.array(
    import_zod.z.object({
      name: import_zod.z.string(),
      value: import_zod.z.string()
    })
  )
});
const EnvListTool = {
  name: "envList",
  description: "List all environment variables in your Convex deployment.",
  inputSchema: envListInputSchema,
  outputSchema: envListOutputSchema,
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
    const variables = await (0, import_run.runSystemQuery)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/queryEnvironmentVariables",
      componentPath: void 0,
      args: {}
    });
    return { variables };
  }
};
const envGetInputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe(
    "Deployment selector (from the status tool) to get environment variable from."
  ),
  name: import_zod.z.string().describe("The name of the environment variable to retrieve.")
});
const envGetOutputSchema = import_zod.z.object({
  value: import_zod.z.union([import_zod.z.string(), import_zod.z.null()])
});
const EnvGetTool = {
  name: "envGet",
  description: "Get a specific environment variable from your Convex deployment.",
  inputSchema: envGetInputSchema,
  outputSchema: envGetOutputSchema,
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
    const envVar = await (0, import_run.runSystemQuery)(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/queryEnvironmentVariables:get",
      componentPath: void 0,
      args: { name: args.name }
    });
    return { value: envVar?.value ?? null };
  }
};
const envSetInputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe(
    "Deployment selector (from the status tool) to set environment variable on."
  ),
  name: import_zod.z.string().describe("The name of the environment variable to set."),
  value: import_zod.z.string().describe("The value to set for the environment variable.")
});
const envSetOutputSchema = import_zod.z.object({
  success: import_zod.z.boolean()
});
const EnvSetTool = {
  name: "envSet",
  description: "Set an environment variable in your Convex deployment.",
  inputSchema: envSetInputSchema,
  outputSchema: envSetOutputSchema,
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
    const deploymentInfo = {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      deploymentNotice: ""
    };
    await (0, import_env.envSetInDeployment)(ctx, deploymentInfo, args.name, args.value);
    return { success: true };
  }
};
const envRemoveInputSchema = import_zod.z.object({
  deploymentSelector: import_zod.z.string().describe(
    "Deployment selector (from the status tool) to remove environment variable from."
  ),
  name: import_zod.z.string().describe("The name of the environment variable to remove.")
});
const envRemoveOutputSchema = import_zod.z.object({
  success: import_zod.z.boolean()
});
const EnvRemoveTool = {
  name: "envRemove",
  description: "Remove an environment variable from your Convex deployment.",
  inputSchema: envRemoveInputSchema,
  outputSchema: envRemoveOutputSchema,
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
    const deploymentInfo = {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      deploymentNotice: ""
    };
    await (0, import_env.envRemoveInDeployment)(ctx, deploymentInfo, args.name);
    return { success: true };
  }
};
//# sourceMappingURL=env.js.map
