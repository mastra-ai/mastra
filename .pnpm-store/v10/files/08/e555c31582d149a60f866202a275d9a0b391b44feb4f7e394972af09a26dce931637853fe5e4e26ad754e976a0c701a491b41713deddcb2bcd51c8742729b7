"use strict";
import {
  bigBrainAPI,
  bigBrainAPIMaybeThrows,
  logAndHandleFetchError,
  ThrowingFetchError
} from "../utils/utils.js";
export async function getCandidateEmailsForWorkIntegration(ctx) {
  return bigBrainAPI({
    ctx,
    method: "GET",
    url: "workos/available_workos_team_emails"
  });
}
export async function getDeploymentCanProvisionWorkOSEnvironments(ctx, deploymentName) {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "workos/has_associated_workos_team",
    data: { deploymentName }
  });
}
export async function createEnvironmentAndAPIKey(ctx, deploymentName) {
  try {
    const data = await bigBrainAPI({
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
export async function createAssociatedWorkosTeam(ctx, teamId, email) {
  try {
    const result = await bigBrainAPIMaybeThrows({
      ctx,
      method: "POST",
      url: "workos/provision_associated_workos_team",
      data: JSON.stringify({ teamId, email })
    });
    return result;
  } catch (error) {
    const data = error instanceof ThrowingFetchError ? error.serverErrorData : void 0;
    if (data?.code === "WorkosAccountAlreadyExistsWithThisEmail") {
      return {
        result: "emailAlreadyUsed",
        message: data?.message || "WorkOS account with this email already exists"
      };
    }
    return await logAndHandleFetchError(ctx, error);
  }
}
//# sourceMappingURL=platformApi.js.map
