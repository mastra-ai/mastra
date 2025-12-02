import { z } from "zod";
import { ConvexTool } from "./index.js";
import { loadSelectedDeploymentCredentials } from "../../api.js";
import {
  envSetInDeployment,
  envRemoveInDeployment,
  EnvVar,
} from "../../env.js";
import { runSystemQuery } from "../../run.js";
import { getDeploymentSelection } from "../../deploymentSelection.js";

// List Environment Variables
const envListInputSchema = z.object({
  deploymentSelector: z
    .string()
    .describe(
      "Deployment selector (from the status tool) to list environment variables from.",
    ),
});

const envListOutputSchema = z.object({
  variables: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ),
});

export const EnvListTool: ConvexTool<
  typeof envListInputSchema,
  typeof envListOutputSchema
> = {
  name: "envList",
  description: "List all environment variables in your Convex deployment.",
  inputSchema: envListInputSchema,
  outputSchema: envListOutputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector,
    );
    process.chdir(projectDir);
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      deployment,
    );
    const variables = (await runSystemQuery(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/queryEnvironmentVariables",
      componentPath: undefined,
      args: {},
    })) as EnvVar[];
    return { variables };
  },
};

// Get Environment Variable
const envGetInputSchema = z.object({
  deploymentSelector: z
    .string()
    .describe(
      "Deployment selector (from the status tool) to get environment variable from.",
    ),
  name: z
    .string()
    .describe("The name of the environment variable to retrieve."),
});

const envGetOutputSchema = z.object({
  value: z.union([z.string(), z.null()]),
});

export const EnvGetTool: ConvexTool<
  typeof envGetInputSchema,
  typeof envGetOutputSchema
> = {
  name: "envGet",
  description:
    "Get a specific environment variable from your Convex deployment.",
  inputSchema: envGetInputSchema,
  outputSchema: envGetOutputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector,
    );
    process.chdir(projectDir);
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      deployment,
    );
    const envVar = (await runSystemQuery(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/queryEnvironmentVariables:get",
      componentPath: undefined,
      args: { name: args.name },
    })) as { name: string; value: string } | null;
    return { value: envVar?.value ?? null };
  },
};

// Set Environment Variable
const envSetInputSchema = z.object({
  deploymentSelector: z
    .string()
    .describe(
      "Deployment selector (from the status tool) to set environment variable on.",
    ),
  name: z.string().describe("The name of the environment variable to set."),
  value: z.string().describe("The value to set for the environment variable."),
});

const envSetOutputSchema = z.object({
  success: z.boolean(),
});

export const EnvSetTool: ConvexTool<
  typeof envSetInputSchema,
  typeof envSetOutputSchema
> = {
  name: "envSet",
  description: "Set an environment variable in your Convex deployment.",
  inputSchema: envSetInputSchema,
  outputSchema: envSetOutputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector,
    );
    process.chdir(projectDir);
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      deployment,
    );
    const deploymentInfo = {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      deploymentNotice: "",
    };
    await envSetInDeployment(ctx, deploymentInfo, args.name, args.value);
    return { success: true };
  },
};

// Remove Environment Variable
const envRemoveInputSchema = z.object({
  deploymentSelector: z
    .string()
    .describe(
      "Deployment selector (from the status tool) to remove environment variable from.",
    ),
  name: z.string().describe("The name of the environment variable to remove."),
});

const envRemoveOutputSchema = z.object({
  success: z.boolean(),
});

export const EnvRemoveTool: ConvexTool<
  typeof envRemoveInputSchema,
  typeof envRemoveOutputSchema
> = {
  name: "envRemove",
  description: "Remove an environment variable from your Convex deployment.",
  inputSchema: envRemoveInputSchema,
  outputSchema: envRemoveOutputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector,
    );
    process.chdir(projectDir);
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      deployment,
    );
    const deploymentInfo = {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      deploymentNotice: "",
    };
    await envRemoveInDeployment(ctx, deploymentInfo, args.name);
    return { success: true };
  },
};
