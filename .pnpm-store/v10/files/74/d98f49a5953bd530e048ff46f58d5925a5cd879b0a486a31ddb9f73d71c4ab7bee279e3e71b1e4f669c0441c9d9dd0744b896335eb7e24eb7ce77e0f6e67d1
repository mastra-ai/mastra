import { z } from "zod";
import { runSystemQuery } from "../../run.js";
import { ConvexTool } from "./index.js";
import { PaginationResult } from "../../../../server/pagination.js";
import { loadSelectedDeploymentCredentials } from "../../api.js";
import { getDeploymentSelection } from "../../deploymentSelection.js";

const inputSchema = z.object({
  deploymentSelector: z
    .string()
    .describe("Deployment selector (from the status tool) to read data from."),
  tableName: z.string().describe("The name of the table to read from."),
  order: z.enum(["asc", "desc"]).describe("The order to sort the results in."),
  cursor: z.string().optional().describe("The cursor to start reading from."),
  limit: z
    .number()
    .max(1000)
    .optional()
    .describe("The maximum number of results to return, defaults to 100."),
});

const outputSchema = z.object({
  page: z.array(z.any()),
  isDone: z.boolean(),
  continueCursor: z.string(),
});

const description = `
Read a page of data from a table in the project's Convex deployment.

Output:
- page: A page of results from the table.
- isDone: Whether there are more results to read.
- continueCursor: The cursor to use to read the next page of results.
`.trim();

export const DataTool: ConvexTool<typeof inputSchema, typeof outputSchema> = {
  name: "data",
  description,
  inputSchema,
  outputSchema,
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
    const paginationResult = (await runSystemQuery(ctx, {
      deploymentUrl: credentials.url,
      adminKey: credentials.adminKey,
      functionName: "_system/cli/tableData",
      componentPath: undefined,
      args: {
        table: args.tableName,
        order: args.order,
        paginationOpts: {
          numItems: args.limit ?? 100,
          cursor: args.cursor ?? null,
        },
      },
    })) as unknown as PaginationResult<any>;
    return {
      page: paginationResult.page,
      isDone: paginationResult.isDone,
      continueCursor: paginationResult.continueCursor,
    };
  },
};
