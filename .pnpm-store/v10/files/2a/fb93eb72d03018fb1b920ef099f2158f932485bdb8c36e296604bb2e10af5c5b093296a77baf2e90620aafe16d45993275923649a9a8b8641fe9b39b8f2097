"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var deployments_exports = {};
__export(deployments_exports, {
  deployments: () => deployments
});
module.exports = __toCommonJS(deployments_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_api = require("./lib/api.js");
const deployments = new import_extra_typings.Command("deployments").description("List deployments associated with a project").allowExcessArguments(false).action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await displayCurrentDeploymentInfo(ctx, deploymentSelection);
});
async function displayCurrentDeploymentInfo(ctx, selection) {
  (0, import_log.logMessage)("Currently configured deployment:");
  switch (selection.kind) {
    case "existingDeployment": {
      const { deploymentToActOn } = selection;
      (0, import_log.logMessage)(`  URL: ${deploymentToActOn.url}`);
      if (deploymentToActOn.deploymentFields) {
        const fields = deploymentToActOn.deploymentFields;
        (0, import_log.logMessage)(
          `  Deployment: ${fields.deploymentName} (${fields.deploymentType})`
        );
        (0, import_log.logMessage)(`  Team: ${fields.teamSlug}`);
        (0, import_log.logMessage)(`  Project: ${fields.projectSlug}`);
      } else {
        (0, import_log.logMessage)(`  Type: ${deploymentToActOn.source}`);
      }
      break;
    }
    case "deploymentWithinProject": {
      const { targetProject } = selection;
      if (targetProject.kind === "teamAndProjectSlugs") {
        (0, import_log.logMessage)(`  Team: ${targetProject.teamSlug}`);
        (0, import_log.logMessage)(`  Project: ${targetProject.projectSlug}`);
      } else if (targetProject.kind === "deploymentName") {
        const slugs = await (0, import_api.fetchTeamAndProject)(
          ctx,
          targetProject.deploymentName
        );
        (0, import_log.logMessage)(`  Team: ${slugs.team}`);
        (0, import_log.logMessage)(`  Project: ${slugs.project}`);
        (0, import_log.logMessage)(`  Deployment: ${targetProject.deploymentName}`);
        if (targetProject.deploymentType) {
          (0, import_log.logMessage)(`  Type: ${targetProject.deploymentType}`);
        }
      } else {
        (0, import_log.logMessage)(`  Project deploy key configured`);
      }
      break;
    }
    case "preview": {
      (0, import_log.logMessage)(`  Preview deployment (deploy key configured)`);
      break;
    }
    case "anonymous": {
      if (selection.deploymentName) {
        (0, import_log.logMessage)(`  Anonymous deployment: ${selection.deploymentName}`);
      } else {
        (0, import_log.logMessage)(`  Anonymous development (no deployment selected)`);
      }
      break;
    }
    case "chooseProject": {
      (0, import_log.logMessage)(`  No project configured - will prompt interactively`);
      break;
    }
    default: {
      (0, import_log.logMessage)(`  Unknown deployment configuration`);
    }
  }
}
//# sourceMappingURL=deployments.js.map
