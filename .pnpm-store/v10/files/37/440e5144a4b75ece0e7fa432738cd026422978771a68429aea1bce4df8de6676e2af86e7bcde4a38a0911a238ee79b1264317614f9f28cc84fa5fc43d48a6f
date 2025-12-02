import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials,
} from "./lib/api.js";
import { actionDescription } from "./lib/command.js";
import { logsForDeployment } from "./lib/logs.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";

export const logs = new Command("logs")
  .summary("Watch logs from your deployment")
  .description(
    "Stream function logs from your Convex deployment.\nBy default, this streams from your project's dev deployment.",
  )
  .allowExcessArguments(false)
  .addLogsOptions()
  .addDeploymentSelectionOptions(actionDescription("Watch logs from"))
  .showHelpAfterError()
  .action(async (cmdOptions) => {
    const ctx = await oneoffContext(cmdOptions);

    const selectionWithinProject =
      deploymentSelectionWithinProjectFromOptions(cmdOptions);
    const deploymentSelection = await getDeploymentSelection(ctx, cmdOptions);
    const deployment = await loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      selectionWithinProject,
    );
    const deploymentName = deployment.deploymentFields?.deploymentName
      ? ` ${deployment.deploymentFields.deploymentName}`
      : "";
    const deploymentNotice = ` for ${cmdOptions.prod ? "production" : "dev"} deployment${deploymentName}`;
    await logsForDeployment(ctx, deployment, {
      history: cmdOptions.history,
      success: cmdOptions.success,
      jsonl: cmdOptions.jsonl,
      deploymentNotice,
    });
  });
