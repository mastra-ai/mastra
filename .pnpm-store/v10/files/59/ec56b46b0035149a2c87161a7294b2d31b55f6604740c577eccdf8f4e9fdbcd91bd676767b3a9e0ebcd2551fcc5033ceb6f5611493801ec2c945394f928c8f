"use strict";
import { z } from "zod";
import { loadSelectedDeploymentCredentials } from "../../api.js";
import { runSystemQuery } from "../../run.js";
import { deploymentFetch } from "../../utils/utils.js";
import { getDeploymentSelection } from "../../deploymentSelection.js";
const inputSchema = z.object({
  deploymentSelector: z.string().describe(
    "Deployment selector (from the status tool) to read tables from."
  )
});
const outputSchema = z.object({
  tables: z.record(
    z.string(),
    z.object({
      schema: z.any().optional(),
      inferredSchema: z.any().optional()
    })
  )
});
export const TablesTool = {
  name: "tables",
  description: "List all tables in a particular Convex deployment and their inferred and declared schema.",
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
    const schemaResponse = await runSystemQuery(ctx, {
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
    const fetch = deploymentFetch(ctx, {
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
const activeSchemaEntry = z.object({
  tableName: z.string(),
  indexes: z.array(z.any()),
  searchIndexes: z.array(z.any()),
  vectorIndexes: z.array(z.any()),
  documentType: z.any()
});
const activeSchema = z.object({ tables: z.array(activeSchemaEntry) });
//# sourceMappingURL=tables.js.map
