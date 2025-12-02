"use strict";
import { Command } from "@commander-js/extra-typings";
import chalk from "chalk";
import { oneoffContext } from "../bundler/context.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import { actionDescription } from "./lib/command.js";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import {
  envGetInDeploymentAction,
  envListInDeployment,
  envRemoveInDeployment,
  envSetInDeployment
} from "./lib/env.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
const envSet = new Command("set").usage("[options] <name> <value>").arguments("<name> [value]").summary("Set a variable").description(
  "Set a variable: `npx convex env set NAME value`\nRead from stdin: `echo 'value' | npx convex env set NAME`\nIf the variable already exists, its value is updated.\n\nA single `NAME=value` argument is also supported."
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (originalName, originalValue, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await ensureHasConvexDependency(ctx, "env set");
  await envSetInDeployment(ctx, deployment, originalName, originalValue);
});
async function selectEnvDeployment(options) {
  const ctx = await oneoffContext(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(options);
  const {
    adminKey,
    url: deploymentUrl,
    deploymentFields
  } = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = deploymentFields !== null ? ` (on ${chalk.bold(deploymentFields.deploymentType)} deployment ${chalk.bold(deploymentFields.deploymentName)})` : "";
  return {
    ctx,
    deployment: {
      deploymentUrl,
      adminKey,
      deploymentNotice
    }
  };
}
const envGet = new Command("get").arguments("<name>").summary("Print a variable's value").description("Print a variable's value: `npx convex env get NAME`").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (envVarName, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await ensureHasConvexDependency(ctx, "env get");
  await envGetInDeploymentAction(ctx, deployment, envVarName);
});
const envRemove = new Command("remove").alias("rm").alias("unset").arguments("<name>").summary("Unset a variable").description(
  "Unset a variable: `npx convex env remove NAME`\nIf the variable doesn't exist, the command doesn't do anything and succeeds."
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (name, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await ensureHasConvexDependency(ctx, "env remove");
  await envRemoveInDeployment(ctx, deployment, name);
});
const envList = new Command("list").summary("List all variables").description("List all variables: `npx convex env list`").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (_options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await ensureHasConvexDependency(ctx, "env list");
  await envListInDeployment(ctx, deployment);
});
export const env = new Command("env").summary("Set and view environment variables").description(
  "Set and view environment variables on your deployment\n\n  Set a variable: `npx convex env set NAME value`\n  Unset a variable: `npx convex env remove NAME`\n  List all variables: `npx convex env list`\n  Print a variable's value: `npx convex env get NAME`\n\nBy default, this sets and views variables on your dev deployment."
).addCommand(envSet).addCommand(envGet).addCommand(envRemove).addCommand(envList).addHelpCommand(false).addDeploymentSelectionOptions(
  actionDescription("Set and view environment variables on")
);
//# sourceMappingURL=env.js.map
