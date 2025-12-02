"use strict";
import chalk from "chalk";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import { Command } from "@commander-js/extra-typings";
import { actionDescription } from "./lib/command.js";
import { deploymentDashboardUrlPage } from "./lib/dashboard.js";
import { importIntoDeployment } from "./lib/convexImport.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
export const convexImport = new Command("import").summary("Import data from a file to your deployment").description(
  "Import data from a file to your Convex deployment.\n\n  From a snapshot: `npx convex import snapshot.zip`\n  For a single table: `npx convex import --table tableName file.json`\n\nBy default, this imports into your dev deployment."
).allowExcessArguments(false).addImportOptions().addDeploymentSelectionOptions(actionDescription("Import data into")).showHelpAfterError().action(async (filePath, options) => {
  const ctx = await oneoffContext(options);
  await ensureHasConvexDependency(ctx, "import");
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const deployment = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = options.prod ? ` in your ${chalk.bold("prod")} deployment` : "";
  await importIntoDeployment(ctx, filePath, {
    ...options,
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentNotice,
    snapshotImportDashboardLink: snapshotImportDashboardLink(
      deployment.deploymentFields?.deploymentName ?? null
    )
  });
});
function snapshotImportDashboardLink(deploymentName) {
  return deploymentName === null ? "https://dashboard.convex.dev/deployment/settings/snapshots" : deploymentDashboardUrlPage(deploymentName, "/settings/snapshots");
}
//# sourceMappingURL=convexImport.js.map
