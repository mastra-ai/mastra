"use strict";
import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import { actionDescription } from "./lib/command.js";
import { runInDeployment } from "./lib/run.js";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
export const run = new Command("run").description("Run a function (query, mutation, or action) on your deployment").allowExcessArguments(false).addRunOptions().addDeploymentSelectionOptions(actionDescription("Run the function on")).showHelpAfterError().action(async (functionName, argsString, options) => {
  const ctx = await oneoffContext(options);
  await ensureHasConvexDependency(ctx, "run");
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const deployment = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  if (deployment.deploymentFields?.deploymentType === "prod" && options.push) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `\`convex run\` doesn't support pushing functions to prod deployments. Remove the --push flag. To push to production use \`npx convex deploy\`.`
    });
  }
  await runInDeployment(ctx, {
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentName: deployment.deploymentFields?.deploymentName ?? null,
    functionName,
    argsString: argsString ?? "{}",
    componentPath: options.component,
    identityString: options.identity,
    push: !!options.push,
    watch: !!options.watch,
    typecheck: options.typecheck,
    typecheckComponents: options.typecheckComponents,
    codegen: options.codegen === "enable",
    liveComponentSources: !!options.liveComponentSources
  });
});
//# sourceMappingURL=run.js.map
