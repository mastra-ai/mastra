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
var integration_exports = {};
__export(integration_exports, {
  integration: () => integration
});
module.exports = __toCommonJS(integration_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_chalk = __toESM(require("chalk"), 1);
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_utils = require("./lib/utils/utils.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_workos = require("./lib/workos/workos.js");
var import_platformApi = require("./lib/workos/platformApi.js");
var import_log = require("../bundler/log.js");
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
      deploymentName: deploymentFields.deploymentName,
      deploymentUrl,
      adminKey,
      deploymentNotice
    }
  };
}
const workosTeamStatus = new import_extra_typings.Command("status").summary("Status of associated WorkOS team").action(async (_options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  const { hasAssociatedWorkosTeam } = await (0, import_platformApi.getDeploymentCanProvisionWorkOSEnvironments)(
    ctx,
    deployment.deploymentName
  );
  const info = await (0, import_api.getTeamAndProjectSlugForDeployment)(ctx, {
    deploymentName: deployment.deploymentName
  });
  const { availableEmails } = await (0, import_platformApi.getCandidateEmailsForWorkIntegration)(ctx);
  if (!hasAssociatedWorkosTeam) {
    (0, import_log.logMessage)(
      `Convex team ${info?.teamSlug} does not have an associated WorkOS team.`
    );
    (0, import_log.logMessage)(
      `Verified emails that mighe be able to add one: ${availableEmails.join(" ")}`
    );
    return;
  }
  (0, import_log.logMessage)(`Convex team ${info?.teamSlug} has an associated WorkOS team.`);
});
const workosProvisionEnvironment = new import_extra_typings.Command("provision-environment").summary("Provision a WorkOS environment").description(
  "Create or get the WorkOS environment and API key for this deployment"
).configureHelp({ showGlobalOptions: true }).allowExcessArguments(false).addDeploymentSelectionOptions(
  (0, import_command.actionDescription)("Provision WorkOS environment for")
).action(async (_options, cmd) => {
  const options = cmd.optsWithGlobals();
  const { ctx, deployment } = await selectEnvDeployment(options);
  await (0, import_utils.ensureHasConvexDependency)(
    ctx,
    "integration workos provision-environment"
  );
  try {
    await (0, import_workos.ensureWorkosEnvironmentProvisioned)(
      ctx,
      deployment.deploymentName,
      deployment,
      {
        offerToAssociateWorkOSTeam: true,
        autoProvisionIfWorkOSTeamAssociated: true,
        autoConfigureAuthkitConfig: true
      }
    );
  } catch (error) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      errForSentry: error,
      printedMessage: `Failed to provision WorkOS environment: ${String(error)}`
    });
  }
});
const workos = new import_extra_typings.Command("workos").summary("WorkOS integration commands").description("Manage WorkOS team provisioning and environment setup").addCommand(workosProvisionEnvironment).addCommand(workosTeamStatus);
const integration = new import_extra_typings.Command("integration").summary("Integration commands").description("Commands for managing third-party integrations").addCommand(workos);
//# sourceMappingURL=integration.js.map
