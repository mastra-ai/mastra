"use strict";
import chalk from "chalk";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import { Command } from "@commander-js/extra-typings";
import { actionDescription } from "./lib/command.js";
import { dataInDeployment } from "./lib/data.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
export const data = new Command("data").summary("List tables and print data from your database").description(
  "Inspect your Convex deployment's database.\n\n  List tables: `npx convex data`\n  List documents in a table: `npx convex data tableName`\n\nBy default, this inspects your dev deployment."
).allowExcessArguments(false).addDataOptions().addDeploymentSelectionOptions(actionDescription("Inspect the database in")).showHelpAfterError().action(async (tableName, options) => {
  const ctx = await oneoffContext(options);
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const deployment = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = deployment.deploymentFields?.deploymentName ? `${chalk.bold(deployment.deploymentFields.deploymentName)} deployment's ` : "";
  await dataInDeployment(ctx, {
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentNotice,
    tableName,
    ...options
  });
});
//# sourceMappingURL=data.js.map
