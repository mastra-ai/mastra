"use strict";
import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import { deploymentDashboardUrlPage } from "./lib/dashboard.js";
import { actionDescription } from "./lib/command.js";
import { exportFromDeployment } from "./lib/convexExport.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
export const convexExport = new Command("export").summary("Export data from your deployment to a ZIP file").description(
  "Export data, and optionally file storage, from your Convex deployment to a ZIP file.\nBy default, this exports from your dev deployment."
).allowExcessArguments(false).addExportOptions().addDeploymentSelectionOptions(actionDescription("Export data from")).showHelpAfterError().action(async (options) => {
  const ctx = await oneoffContext(options);
  await ensureHasConvexDependency(ctx, "export");
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(options);
  const deployment = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = options.prod ? ` in your ${chalk.bold("prod")} deployment` : "";
  await exportFromDeployment(ctx, {
    ...options,
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentNotice,
    snapshotExportDashboardLink: deploymentDashboardUrlPage(
      deployment.deploymentFields?.deploymentName ?? null,
      "/settings/snapshot-export"
    )
  });
});
//# sourceMappingURL=convexExport.js.map
