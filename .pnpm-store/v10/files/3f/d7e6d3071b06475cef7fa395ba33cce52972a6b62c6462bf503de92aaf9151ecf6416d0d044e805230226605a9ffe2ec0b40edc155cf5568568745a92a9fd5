"use strict";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import { Command, Option } from "@commander-js/extra-typings";
import { actionDescription } from "./lib/command.js";
import { functionSpecForDeployment } from "./lib/functionSpec.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
export const functionSpec = new Command("function-spec").summary("List function metadata from your deployment").description(
  "List argument and return values to your Convex functions.\n\nBy default, this inspects your dev deployment."
).allowExcessArguments(false).addOption(new Option("--file", "Output as JSON to a file.")).addDeploymentSelectionOptions(
  actionDescription("Read function metadata from")
).showHelpAfterError().action(async (options) => {
  const ctx = await oneoffContext(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(options);
  const { adminKey, url: deploymentUrl } = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  await functionSpecForDeployment(ctx, {
    deploymentUrl,
    adminKey,
    file: !!options.file
  });
});
//# sourceMappingURL=functionSpec.js.map
