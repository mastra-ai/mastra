import { Context } from "../../../bundler/context.js";
import {
  bigBrainAPI,
  bigBrainAPIMaybeThrows,
  ErrorData,
  logAndHandleFetchError,
  ThrowingFetchError,
} from "../utils/utils.js";

/**
 * Verified emails for a user that aren't known to be an admin email for
 * another WorkOS integration.
 */
export async function getCandidateEmailsForWorkIntegration(
  ctx: Context,
): Promise<{
  availableEmails: string[];
}> {
  return bigBrainAPI<{ availableEmails: string[] }>({
    ctx,
    method: "GET",
    url: "workos/available_workos_team_emails",
  });
}

export async function getDeploymentCanProvisionWorkOSEnvironments(
  ctx: Context,
  deploymentName: string,
): Promise<{
  teamId: number;
  hasAssociatedWorkosTeam: boolean;
  disabled?: boolean;
}> {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "workos/has_associated_workos_team",
    data: { deploymentName },
  });
}

export async function createEnvironmentAndAPIKey(
  ctx: Context,
  deploymentName: string,
): Promise<
  | {
      success: true;
      data: {
        environmentId: string;
        environmentName: string;
        clientId: string;
        apiKey: string;
        newlyProvisioned: boolean;
      };
    }
  | {
      success: false;
      error: "team_not_provisioned";
      message: string;
    }
> {
  try {
    const data = await bigBrainAPI({
      ctx,
      method: "POST",
      url: "workos/get_or_provision_workos_environment",
      data: { deploymentName },
    });
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    if (error?.message?.includes("WorkOSTeamNotProvisioned")) {
      return {
        success: false,
        error: "team_not_provisioned",
        message: error.message,
      };
    }

    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Error provisioning WorkOS environment: ${error}`,
    });
  }
}

export async function createAssociatedWorkosTeam(
  ctx: Context,
  teamId: number,
  email: string,
): Promise<
  | {
      result: "success";
      workosTeamId: string;
      workosTeamName: string;
    }
  | {
      result: "emailAlreadyUsed";
      message: string;
    }
> {
  try {
    const result = await bigBrainAPIMaybeThrows({
      ctx,
      method: "POST",
      url: "workos/provision_associated_workos_team",
      data: JSON.stringify({ teamId, email }),
    });
    return result;
  } catch (error) {
    const data: ErrorData | undefined =
      error instanceof ThrowingFetchError ? error.serverErrorData : undefined;
    if (data?.code === "WorkosAccountAlreadyExistsWithThisEmail") {
      return {
        result: "emailAlreadyUsed",
        message:
          data?.message || "WorkOS account with this email already exists",
      };
    }
    return await logAndHandleFetchError(ctx, error);
  }
}
