import { Command } from "@commander-js/extra-typings";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials,
} from "./lib/api.js";
import { Context, oneoffContext } from "../bundler/context.js";
import { showSpinner, logMessage } from "../bundler/log.js";
import chalk from "chalk";
import { actionDescription } from "./lib/command.js";
import { runNetworkTestOnUrl, withTimeout } from "./lib/networkTest.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";

export const networkTest = new Command("network-test")
  .description("Run a network test to Convex's servers")
  .allowExcessArguments(false)
  .addNetworkTestOptions()
  .addDeploymentSelectionOptions(
    actionDescription("Perform the network test on"),
  )
  .option("--url <url>") // unhide help
  .action(async (options) => {
    const ctx = await oneoffContext(options);
    const timeoutSeconds = options.timeout
      ? Number.parseFloat(options.timeout)
      : 30;
    await withTimeout(
      ctx,
      "Network test",
      timeoutSeconds * 1000,
      runNetworkTest(ctx, options),
    );
  });

async function runNetworkTest(
  ctx: Context,
  options: {
    prod?: boolean | undefined;
    previewName?: string | undefined;
    deploymentName?: string | undefined;
    url?: string | undefined;
    adminKey?: string | undefined;
    ipFamily?: string;
    speedTest?: boolean;
  },
) {
  showSpinner("Performing network test...");
  // Try to fetch the URL following the usual paths, but special case the
  // `--url` argument in case the developer doesn't have network connectivity.
  let url: string;
  let adminKey: string | null;
  if (options.url !== undefined && options.adminKey !== undefined) {
    url = options.url;
    adminKey = options.adminKey;
  } else if (options.url !== undefined) {
    url = options.url;
    adminKey = null;
  } else {
    const selectionWithinProject =
      deploymentSelectionWithinProjectFromOptions(options);
    const deploymentSelection = await getDeploymentSelection(ctx, options);
    const credentials = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      selectionWithinProject,
    );
    url = credentials.url;
    adminKey = credentials.adminKey;
  }
  logMessage(`${chalk.green(`✔`)} Deployment URL: ${url}`);
  await runNetworkTestOnUrl(ctx, { url, adminKey }, options);
}
