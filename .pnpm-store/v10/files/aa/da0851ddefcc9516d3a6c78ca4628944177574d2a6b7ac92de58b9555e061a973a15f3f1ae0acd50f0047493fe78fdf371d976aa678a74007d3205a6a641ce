"use strict";
import { z } from "zod";
import { loadSelectedDeploymentCredentials } from "../../api.js";
import { runSystemQuery } from "../../run.js";
import { getDeploymentSelection } from "../../deploymentSelection.js";
const inputSchema = z.object({
  deploymentSelector: z.string().describe(
    "Deployment selector (from the status tool) to get function metadata from."
  )
});
const outputSchema = z.any().describe("Function metadata including arguments and return values");
const description = `
Get the function metadata from a Convex deployment.

Returns an array of structured objects for each function the deployment. Each function's
metadata contains its identifier (which is its path within the convex/ folder joined
with its exported name), its argument validator, its return value validator, its type
(i.e. is it a query, mutation, or action), and its visibility (i.e. is it public or
internal).
`.trim();
export const FunctionSpecTool = {
  name: "functionSpec",
  description,
  inputSchema,
  outputSchema,
  handler: async (ctx, args) => {
    const { projectDir, deployment } = await ctx.decodeDeploymentSelector(
      args.deploymentSelector
    );
    process.chdir(projectDir);
    const deploymentSelection = await getDeploymentSelection(ctx, ctx.options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      deployment
    );
    const functions = await runSystemQuery(ctx, {
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
