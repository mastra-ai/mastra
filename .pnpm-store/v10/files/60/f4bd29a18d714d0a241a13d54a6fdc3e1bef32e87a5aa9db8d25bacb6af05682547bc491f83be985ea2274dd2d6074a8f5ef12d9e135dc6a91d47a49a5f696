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
var platformApi_exports = {};
__export(platformApi_exports, {
  createAssociatedWorkosTeam: () => createAssociatedWorkosTeam,
  createEnvironmentAndAPIKey: () => createEnvironmentAndAPIKey,
  getCandidateEmailsForWorkIntegration: () => getCandidateEmailsForWorkIntegration,
  getDeploymentCanProvisionWorkOSEnvironments: () => getDeploymentCanProvisionWorkOSEnvironments
});
module.exports = __toCommonJS(platformApi_exports);
var import_utils = require("../utils/utils.js");
async function getCandidateEmailsForWorkIntegration(ctx) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "GET",
    url: "workos/available_workos_team_emails"
  });
}
async function getDeploymentCanProvisionWorkOSEnvironments(ctx, deploymentName) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "workos/has_associated_workos_team",
    data: { deploymentName }
  });
}
async function createEnvironmentAndAPIKey(ctx, deploymentName) {
  try {
    const data = await (0, import_utils.bigBrainAPI)({
      ctx,
      method: "POST",
      url: "workos/get_or_provision_workos_environment",
      data: { deploymentName }
    });
    return {
      success: true,
      data
    };
  } catch (error) {
    if (error?.message?.includes("WorkOSTeamNotProvisioned")) {
      return {
        success: false,
        error: "team_not_provisioned",
        message: error.message
      };
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Error provisioning WorkOS environment: ${error}`
    });
  }
}
async function createAssociatedWorkosTeam(ctx, teamId, email) {
  try {
    const result = await (0, import_utils.bigBrainAPIMaybeThrows)({
      ctx,
      method: "POST",
      url: "workos/provision_associated_workos_team",
      data: JSON.stringify({ teamId, email })
    });
    return result;
  } catch (error) {
    const data = error instanceof import_utils.ThrowingFetchError ? error.serverErrorData : void 0;
    if (data?.code === "WorkosAccountAlreadyExistsWithThisEmail") {
      return {
        result: "emailAlreadyUsed",
        message: data?.message || "WorkOS account with this email already exists"
      };
    }
    return await (0, import_utils.logAndHandleFetchError)(ctx, error);
  }
}
//# sourceMappingURL=platformApi.js.map
