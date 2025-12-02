import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import open from "open";
import { Context, oneoffContext } from "../bundler/context.js";
import { logMessage, logOutput, logWarning } from "../bundler/log.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials,
} from "./lib/api.js";
import { actionDescription } from "./lib/command.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
import { checkIfDashboardIsRunning } from "./lib/localDeployment/dashboard.js";
import { getDashboardUrl } from "./lib/dashboard.js";
import { isAnonymousDeployment } from "./lib/deployment.js";

export const DASHBOARD_HOST = process.env.CONVEX_PROVISION_HOST
  ? "http://localhost:6789"
  : "https://dashboard.convex.dev";

export const dashboard = new Command("dashboard")
  .alias("dash")
  .description("Open the dashboard in the browser")
  .allowExcessArguments(false)
  .option(
    "--no-open",
    "Don't automatically open the dashboard in the default browser",
  )
  .addDeploymentSelectionOptions(actionDescription("Open the dashboard for"))
  .showHelpAfterError()
  .action(async (options) => {
    const ctx = await oneoffContext(options);

    const selectionWithinProject =
      deploymentSelectionWithinProjectFromOptions(options);
    const deploymentSelection = await getDeploymentSelection(ctx, options);
    const deployment = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      selectionWithinProject,
      { ensureLocalRunning: false },
    );

    if (deployment.deploymentFields === null) {
      const msg = `Self-hosted deployment configured.\n\`${chalk.bold("npx convex dashboard")}\` is not supported for self-hosted deployments.\nSee self-hosting instructions for how to self-host the dashboard.`;
      logMessage(chalk.yellow(msg));
      return;
    }
    const dashboardUrl = getDashboardUrl(ctx, deployment.deploymentFields);
    if (isAnonymousDeployment(deployment.deploymentFields.deploymentName)) {
      const warningMessage = `You are not currently running the dashboard locally. Make sure \`npx convex dev\` is running and try again.`;
      if (dashboardUrl === null) {
        logWarning(warningMessage);
        return;
      }
      const isLocalDashboardRunning = await checkIfDashboardIsRunning(ctx);
      if (!isLocalDashboardRunning) {
        logWarning(warningMessage);
        return;
      }
      await logOrOpenUrl(ctx, dashboardUrl, options.open);
      return;
    }

    await logOrOpenUrl(ctx, dashboardUrl ?? DASHBOARD_HOST, options.open);
  });

async function logOrOpenUrl(ctx: Context, url: string, shouldOpen: boolean) {
  if (shouldOpen) {
    logMessage(chalk.gray(`Opening ${url} in the default browser...`));
    try {
      // This can fail e.g. on a headless dev machine.
      await open(url);
    } catch {
      logWarning(
        `⚠️ Could not open dashboard in the default browser.\nPlease visit: ${url}`,
      );
    }
  } else {
    logOutput(url);
  }
}
