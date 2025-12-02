/**
 * Programatic provisioning of a WorkOS environments and configuration of these environemnts.
 *
 * This WorkOS integation is subject to change while in development and may require upgrading the CLI
 * to use in the future.
 *
 * This flow may be kicked off by discovering that WORKOS_CLIENT_ID
 * is required in a convex/auth.config.ts but not present on the deployment.
 */
import crypto from "crypto";
import { Context } from "../../../bundler/context.js";
import {
  changeSpinner,
  logFinishedStep,
  logMessage,
  logWarning,
  showSpinner,
  stopSpinner,
} from "../../../bundler/log.js";
import { getTeamAndProjectSlugForDeployment } from "../api.js";
import { callUpdateEnvironmentVariables, envGetInDeployment } from "../env.js";
import { changedEnvVarFile, suggestedEnvVarName } from "../envvars.js";
import { promptOptions, promptYesNo } from "../utils/prompts.js";
import { createCORSOrigin, createRedirectURI } from "./environmentApi.js";
import {
  createAssociatedWorkosTeam,
  createEnvironmentAndAPIKey,
  getCandidateEmailsForWorkIntegration,
  getDeploymentCanProvisionWorkOSEnvironments,
} from "./platformApi.js";

/**
 * Ensure the current deployment has the three expected WorkOS environment
 * variables defined with values corresponding to a valid WorkOS deployment.
 *
 * This may involve provisioning a WorkOS deployment or even (in interactive
 * terminals only) prompting to provision a new WorkOS team to be associated
 * with this Convex team.
 */
export async function ensureWorkosEnvironmentProvisioned(
  ctx: Context,
  deploymentName: string,
  deployment: {
    deploymentUrl: string;
    adminKey: string;
    deploymentNotice: string;
  },
  options: {
    offerToAssociateWorkOSTeam: boolean;
    autoProvisionIfWorkOSTeamAssociated: boolean;
    autoConfigureAuthkitConfig: boolean;
  },
): Promise<"ready" | "choseNotToAssociatedTeam"> {
  if (!options.autoConfigureAuthkitConfig) {
    return "choseNotToAssociatedTeam";
  }

  showSpinner("Checking for associated AuthKit environment...");
  const existingEnvVars = await getExistingWorkosEnvVars(ctx, deployment);
  if (
    existingEnvVars.clientId &&
    existingEnvVars.environmentId &&
    existingEnvVars.apiKey
  ) {
    logFinishedStep(
      "Deployment has a WorkOS environment configured for AuthKit.",
    );
    await updateEnvLocal(
      ctx,
      existingEnvVars.clientId,
      existingEnvVars.apiKey,
      existingEnvVars.environmentId,
    );
    await updateWorkosEnvironment(ctx, existingEnvVars.apiKey);
    return "ready";
  }

  // We need to provision an environment. Let's figure out if we can:
  const { hasAssociatedWorkosTeam, teamId, disabled } =
    await getDeploymentCanProvisionWorkOSEnvironments(ctx, deploymentName);

  // In case this this becomes a legacy flow that no longer works.
  if (disabled) {
    return "choseNotToAssociatedTeam";
  }
  if (!hasAssociatedWorkosTeam) {
    if (!options.offerToAssociateWorkOSTeam) {
      return "choseNotToAssociatedTeam";
    }
    const result = await tryToCreateAssociatedWorkosTeam(
      ctx,
      deploymentName,
      teamId,
    );
    if (result === "choseNotToAssociatedTeam") {
      return "choseNotToAssociatedTeam";
    }
    result satisfies "ready";
  }

  const environmentResult = await createEnvironmentAndAPIKey(
    ctx,
    deploymentName,
  );

  if (!environmentResult.success) {
    if (environmentResult.error === "team_not_provisioned") {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Team unexpectedly has no provisioned WorkOS team: ${environmentResult.message}`,
      });
    }
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: environmentResult.message,
    });
  }

  const data = environmentResult.data;
  if (data.newlyProvisioned) {
    logMessage("New AuthKit environment provisioned");
  } else {
    changeSpinner("Using existing AuthKit environment");
  }

  changeSpinner("Setting WORKOS_* deployment environment variables...");
  await setConvexEnvVars(
    ctx,
    deployment,
    data.clientId,
    data.environmentId,
    data.apiKey,
  );
  showSpinner("Updating .env.local with WorkOS configuration");
  await updateEnvLocal(ctx, data.clientId, data.apiKey, data.environmentId);

  await updateWorkosEnvironment(ctx, data.apiKey);

  return "ready";
}

export async function tryToCreateAssociatedWorkosTeam(
  ctx: Context,
  deploymentName: string,
  teamId: number,
): Promise<"ready" | "choseNotToAssociatedTeam"> {
  const teamInfo = await getTeamAndProjectSlugForDeployment(ctx, {
    deploymentName,
  });
  if (teamInfo === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Can't find Convex Cloud team for deployment ${deploymentName}`,
    });
  }
  stopSpinner();

  const agree = await promptYesNo(ctx, {
    prefix: `A WorkOS team needs to be created for your Convex team "${teamInfo.teamSlug}" in order to use AuthKit.

You and other members of this team will be able to create WorkOS environments for each Convex dev deployment for projects in this team.

By creating this account you agree to the WorkOS Terms of Service (https://workos.com/legal/terms-of-service) and Privacy Policy (https://workos.com/legal/privacy).
Alternately, choose no and set WORKOS_CLIENT_ID for an existing WorkOS environment.
\n`,
    message: `Create a WorkOS team and enable automatic AuthKit environment provisioning for team "${teamInfo.teamSlug}"?`,
  });
  if (!agree) {
    return "choseNotToAssociatedTeam";
  }

  const alreadyTried = new Map<string, string>();

  let email;
  while (true) {
    let choice = "refresh";
    while (choice === "refresh") {
      const { availableEmails } =
        await getCandidateEmailsForWorkIntegration(ctx);
      choice = await promptOptions<string>(ctx, {
        message:
          availableEmails.length === 1
            ? "Create a new WorkOS team with this email address?"
            : "Create a new WorkOS team with which email address?",
        suffix:
          availableEmails.length === 0
            ? "\nVisit https://dashboard.convex.dev/profile to add a verified email to use to provision a WorkOS account"
            : availableEmails.length === 1
              ? "\nCreate a new WorkOS team with this email address?"
              : "\nTo use another email address visit https://dashboard.convex.dev/profile to add and verify, then choose 'refresh'",
        choices: [
          ...availableEmails.map((email) => ({
            name: `${email}${alreadyTried.has(email) ? ` (can't create, a WorkOS team already exists with this email)` : ""}`,
            value: email,
          })),
          {
            name: "refresh (add an email at https://dashboard.convex.dev/profile)",
            value: "refresh",
          } as const,
          {
            name: "cancel (do not create a WorkOS account)",
            value: "cancel",
          } as const,
        ],
      });
    }
    if (choice === "cancel") {
      return "choseNotToAssociatedTeam";
    }
    email = choice;

    const teamResult = await createAssociatedWorkosTeam(ctx, teamId, email);

    if (teamResult.result === "emailAlreadyUsed") {
      logMessage(teamResult.message);
      alreadyTried.set(email, teamResult.message);
      continue;
    }
    break;
  }
  logFinishedStep("WorkOS team created successfully");
  return "ready";
}

// Helpers

// In the future this will be configurable.
// Perhaps with an API like `authKit({ redirectUri: 'asdf' })
async function updateWorkosEnvironment(
  ctx: Context,
  workosApiKey: string,
): Promise<void> {
  let { frontendDevUrl } = await suggestedEnvVarName(ctx);
  frontendDevUrl = frontendDevUrl || "http://localhost:5173";
  const redirectUri = `${frontendDevUrl}/callback`;
  const corsOrigin = `${frontendDevUrl}`;

  await applyConfigToWorkosEnvironment(ctx, {
    workosApiKey,
    redirectUri,
    corsOrigin,
  });
}

async function applyConfigToWorkosEnvironment(
  ctx: Context,
  {
    workosApiKey,
    redirectUri,
    corsOrigin,
  }: {
    workosApiKey: string;
    redirectUri: string;
    corsOrigin: string;
  },
): Promise<void> {
  changeSpinner("Configuring AuthKit redirect URI...");
  const { modified: redirectUriAdded } = await createRedirectURI(
    ctx,
    workosApiKey,
    redirectUri,
  );
  if (redirectUriAdded) {
    logMessage(`AuthKit redirect URI added: ${redirectUri}`);
  }

  changeSpinner("Configuring AuthKit CORS origin...");
  const { modified: corsAdded } = await createCORSOrigin(
    ctx,
    workosApiKey,
    corsOrigin,
  );
  if (corsAdded) {
    logMessage(`AuthKit CORS origin added: ${corsOrigin}`);
  }
}

// Given a WORKOS_CLIENT_ID try to configure the .env.local appropriately
// for a framework. This flow supports only Vite and Next.js for now.
async function updateEnvLocal(
  ctx: Context,
  clientId: string,
  apiKey: string,
  environmentId: string,
) {
  const envPath = ".env.local";

  const { frontendDevUrl, detectedFramework, publicPrefix } =
    await suggestedEnvVarName(ctx);

  // For now don't attempt for anything other than Vite or Next.js.
  if (
    !detectedFramework ||
    !["Vite", "Next.js", "TanStackStart"].includes(detectedFramework)
  ) {
    logWarning(
      "Can't configure .env.local, fill it out according to directions for the corresponding AuthKit SDK. Use `npx convex list` to see relevant environment variables.",
    );
  }

  let suggestedChanges: Record<
    string,
    {
      value: string;
      commentAfterValue?: string;
      commentOnPreviousLine?: string;
    }
  > = {};

  let existingFileContent = ctx.fs.exists(envPath)
    ? ctx.fs.readUtf8File(envPath)
    : null;

  if (publicPrefix) {
    if (detectedFramework === "Vite") {
      suggestedChanges[`${publicPrefix}WORKOS_CLIENT_ID`] = {
        value: clientId,
        commentOnPreviousLine: `# See this environment at ${workosUrl(environmentId, "/authentication")}`,
      };
    } else if (
      detectedFramework === "Next.js" ||
      detectedFramework === "TanStackStart"
    ) {
      // Next/TanStack Start don’t need the client id to be public
      suggestedChanges[`WORKOS_CLIENT_ID`] = {
        value: clientId,
        commentOnPreviousLine: `# See this environment at ${workosUrl(environmentId, "/authentication")}`,
      };
    }

    if (frontendDevUrl) {
      suggestedChanges[
        detectedFramework === "TanStackStart"
          ? "WORKOS_REDIRECT_URI"
          : `${publicPrefix}WORKOS_REDIRECT_URI`
      ] = {
        value: `${frontendDevUrl}/callback`,
      };
    }
  }

  if (
    detectedFramework === "Next.js" ||
    detectedFramework === "TanStackStart"
  ) {
    if (
      !existingFileContent ||
      !existingFileContent.includes("WORKOS_COOKIE_PASSWORD")
    ) {
      suggestedChanges["WORKOS_COOKIE_PASSWORD"] = {
        value: crypto.randomBytes(32).toString("base64url"),
      };
    }
    suggestedChanges["WORKOS_API_KEY"] = { value: apiKey };
  }

  for (const [
    envVarName,
    { value: envVarValue, commentOnPreviousLine, commentAfterValue },
  ] of Object.entries(suggestedChanges) as [
    string,
    {
      value: string;
      commentOnPreviousLine?: string;
      commentAfterValue?: string;
    },
  ][]) {
    existingFileContent =
      changedEnvVarFile({
        existingFileContent,
        envVarName,
        envVarValue,
        commentAfterValue: commentAfterValue ?? null,
        commentOnPreviousLine: commentOnPreviousLine ?? null,
      }) || existingFileContent;
  }

  if (existingFileContent !== null) {
    ctx.fs.writeUtf8File(envPath, existingFileContent);
    logMessage(
      `Updated .env.local with ${Object.keys(suggestedChanges).join(", ")}`,
    );
  }
}

async function getExistingWorkosEnvVars(
  ctx: Context,
  deployment: {
    deploymentUrl: string;
    adminKey: string;
  },
): Promise<{
  clientId: string | null;
  environmentId: string | null;
  apiKey: string | null;
}> {
  const [clientId, environmentId, apiKey] = await Promise.all([
    envGetInDeployment(ctx, deployment, "WORKOS_CLIENT_ID"),
    envGetInDeployment(ctx, deployment, "WORKOS_ENVIRONMENT_ID"),
    envGetInDeployment(ctx, deployment, "WORKOS_ENVIRONMENT_API_KEY"),
  ]);

  return { clientId, environmentId, apiKey };
}

async function setConvexEnvVars(
  ctx: Context,
  deployment: {
    deploymentUrl: string;
    adminKey: string;
    deploymentNotice: string;
  },
  workosClientId: string,
  workosEnvironmentId: string,
  workosEnvironmentApiKey: string,
) {
  await callUpdateEnvironmentVariables(ctx, deployment, [
    { name: "WORKOS_CLIENT_ID", value: workosClientId },
    { name: "WORKOS_ENVIRONMENT_ID", value: workosEnvironmentId },
    { name: "WORKOS_ENVIRONMENT_API_KEY", value: workosEnvironmentApiKey },
  ]);
}

type Subpaths = "/authentication" | "/sessions" | "/redirects" | "/users";
function workosUrl(environmentId: string, subpath: Subpaths) {
  return `https://dashboard.workos.com/${environmentId}${subpath}`;
}
