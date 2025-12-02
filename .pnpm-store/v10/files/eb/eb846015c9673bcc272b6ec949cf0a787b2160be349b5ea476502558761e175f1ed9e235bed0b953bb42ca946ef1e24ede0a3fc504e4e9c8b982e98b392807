"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var env_exports = {};
__export(env_exports, {
  env: () => env
});
module.exports = __toCommonJS(env_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = __toESM(require("chalk"), 1);
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_utils = require("./lib/utils/utils.js");
var import_env = require("./lib/env.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const envSet = new import_extra_typings.Command("set").usage("[options] <name> <value>").arguments("<name> [value]").summary("Set a variable").description(
  "Set a variable: `npx convex env set NAME value`\nRead from stdin: `echo 'value' | npx convex env set NAME`\nIf the variable already exists, its value is updated.\n\nA single `NAME=value` argument is also supported."
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (originalName, originalValue, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env set");
  await (0, import_env.envSetInDeployment)(ctx, deployment, originalName, originalValue);
});
async function selectEnvDeployment(options) {
  const ctx = await (0, import_context.oneoffContext)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const {
    adminKey,
    url: deploymentUrl,
    deploymentFields
  } = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = deploymentFields !== null ? ` (on ${import_chalk.default.bold(deploymentFields.deploymentType)} deployment ${import_chalk.default.bold(deploymentFields.deploymentName)})` : "";
  return {
    ctx,
    deployment: {
      deploymentUrl,
      adminKey,
      deploymentNotice
    }
  };
}
const envGet = new import_extra_typings.Command("get").arguments("<name>").summary("Print a variable's value").description("Print a variable's value: `npx convex env get NAME`").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (envVarName, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env get");
  await (0, import_env.envGetInDeploymentAction)(ctx, deployment, envVarName);
});
const envRemove = new import_extra_typings.Command("remove").alias("rm").alias("unset").arguments("<name>").summary("Unset a variable").description(
  "Unset a variable: `npx convex env remove NAME`\nIf the variable doesn't exist, the command doesn't do anything and succeeds."
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (name, _options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env remove");
  await (0, import_env.envRemoveInDeployment)(ctx, deployment, name);
});
const envList = new import_extra_typings.Command("list").summary("List all variables").description("List all variables: `npx convex env list`").configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).action(async (_options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "env list");
  await (0, import_env.envListInDeployment)(ctx, deployment);
});
const env = new import_extra_typings.Command("env").summary("Set and view environment variables").description(
  "Set and view environment variables on your deployment\n\n  Set a variable: `npx convex env set NAME value`\n  Unset a variable: `npx convex env remove NAME`\n  List all variables: `npx convex env list`\n  Print a variable's value: `npx convex env get NAME`\n\nBy default, this sets and views variables on your dev deployment."
).addCommand(envSet).addCommand(envGet).addCommand(envRemove).addCommand(envList).addHelpCommand(false).addDeploymentSelectionOptions(
  (0, import_command.actionDescription)("Set and view environment variables on")
);
//# sourceMappingURL=env.js.map
