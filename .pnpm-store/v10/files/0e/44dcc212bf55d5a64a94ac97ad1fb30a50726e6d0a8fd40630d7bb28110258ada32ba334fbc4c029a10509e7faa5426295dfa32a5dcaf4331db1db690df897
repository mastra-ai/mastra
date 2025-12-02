"use strict";
import { logVerbose, logWarning } from "../../bundler/log.js";
import { getTeamAndProjectFromPreviewAdminKey } from "./deployment.js";
import {
  assertLocalBackendRunning,
  localDeploymentUrl
} from "./localDeployment/run.js";
import {
  ThrowingFetchError,
  bigBrainAPI,
  bigBrainAPIMaybeThrows,
  logAndHandleFetchError
} from "./utils/utils.js";
import { z } from "zod";
import { loadLocalDeploymentCredentials } from "./localDeployment/localDeployment.js";
import { loadAnonymousDeployment } from "./localDeployment/anonymous.js";
export async function createProject(ctx, {
  teamSlug: selectedTeamSlug,
  projectName,
  deploymentTypeToProvision
}) {
  const provisioningArgs = {
    team: selectedTeamSlug,
    projectName,
    // TODO: Consider allowing projects with no deployments, or consider switching
    // to provisioning prod on creation.
    deploymentType: deploymentTypeToProvision
  };
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "create_project",
    data: provisioningArgs
  });
  const { projectSlug, teamSlug, projectsRemaining } = data;
  if (projectSlug === void 0 || teamSlug === void 0 || projectsRemaining === void 0) {
    const error = "Unexpected response during provisioning: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: error,
      printedMessage: error
    });
  }
  return {
    projectSlug,
    teamSlug,
    projectsRemaining
  };
}
export const deploymentSelectionWithinProjectSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("previewName"), previewName: z.string() }),
    z.object({ kind: z.literal("deploymentName"), deploymentName: z.string() }),
    z.object({ kind: z.literal("prod") }),
    z.object({ kind: z.literal("implicitProd") }),
    z.object({ kind: z.literal("ownDev") })
  ]
);
export function deploymentSelectionWithinProjectFromOptions(options) {
  if (options.previewName !== void 0) {
    return { kind: "previewName", previewName: options.previewName };
  }
  if (options.deploymentName !== void 0) {
    return { kind: "deploymentName", deploymentName: options.deploymentName };
  }
  if (options.prod) {
    return { kind: "prod" };
  }
  if (options.implicitProd) {
    return { kind: "implicitProd" };
  }
  return { kind: "ownDev" };
}
export async function validateDeploymentSelectionForExistingDeployment(ctx, deploymentSelection, source) {
  if (deploymentSelection.kind === "ownDev" || deploymentSelection.kind === "implicitProd") {
    return;
  }
  switch (source) {
    case "selfHosted":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "The `--prod`, `--preview-name`, and `--deployment-name` flags cannot be used with a self-hosted deployment."
      });
    case "deployKey":
      logWarning(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags and using deployment from CONVEX_DEPLOY_KEY"
      );
      break;
    case "cliArgs":
      logWarning(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags since this command was run with --url and --admin-key"
      );
      break;
  }
}
async function hasAccessToProject(ctx, selector) {
  try {
    await bigBrainAPIMaybeThrows({
      ctx,
      url: `teams/${selector.teamSlug}/projects/${selector.projectSlug}/deployments`,
      method: "GET"
    });
    return true;
  } catch (err) {
    if (err instanceof ThrowingFetchError && (err.serverErrorData?.code === "TeamNotFound" || err.serverErrorData?.code === "ProjectNotFound")) {
      return false;
    }
    return logAndHandleFetchError(ctx, err);
  }
}
export async function checkAccessToSelectedProject(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      const result = await getTeamAndProjectSlugForDeployment(ctx, {
        deploymentName: projectSelection.deploymentName
      });
      if (result === null) {
        return { kind: "noAccess" };
      }
      return {
        kind: "hasAccess",
        teamSlug: result.teamSlug,
        projectSlug: result.projectSlug
      };
    }
    case "teamAndProjectSlugs": {
      const hasAccess = await hasAccessToProject(ctx, {
        teamSlug: projectSelection.teamSlug,
        projectSlug: projectSelection.projectSlug
      });
      if (!hasAccess) {
        return { kind: "noAccess" };
      }
      return {
        kind: "hasAccess",
        teamSlug: projectSelection.teamSlug,
        projectSlug: projectSelection.projectSlug
      };
    }
    case "projectDeployKey":
      return { kind: "unknown" };
    default: {
      projectSelection;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Invalid project selection: ${projectSelection.kind}`
      });
    }
  }
}
export async function getTeamAndProjectSlugForDeployment(ctx, selector) {
  try {
    const body = await bigBrainAPIMaybeThrows({
      ctx,
      url: `deployment/${selector.deploymentName}/team_and_project`,
      method: "GET"
    });
    return { teamSlug: body.team, projectSlug: body.project };
  } catch (err) {
    if (err instanceof ThrowingFetchError && (err.serverErrorData?.code === "DeploymentNotFound" || err.serverErrorData?.code === "ProjectNotFound")) {
      return null;
    }
    return logAndHandleFetchError(ctx, err);
  }
}
export async function fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(ctx, projectSelection, deploymentType) {
  if (projectSelection.kind === "projectDeployKey") {
    const auth = ctx.bigBrainAuth();
    const doesAuthMatch = auth !== null && auth.kind === "projectKey" && auth.projectKey === projectSelection.projectDeployKey;
    if (!doesAuthMatch) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: new Error(
          "Expected project deploy key to match the big brain auth header"
        ),
        printedMessage: "Unexpected error when loading the Convex deployment"
      });
    }
  }
  let data;
  try {
    data = await bigBrainAPIMaybeThrows({
      ctx,
      method: "POST",
      url: "deployment/provision_and_authorize",
      data: {
        teamSlug: projectSelection.kind === "teamAndProjectSlugs" ? projectSelection.teamSlug : null,
        projectSlug: projectSelection.kind === "teamAndProjectSlugs" ? projectSelection.projectSlug : null,
        deploymentType: deploymentType === "prod" ? "prod" : "dev"
      }
    });
  } catch (error) {
    const msg = "Unknown error during authorization: " + error;
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  const adminKey = data.adminKey;
  const url = data.url;
  const deploymentName = data.deploymentName;
  if (adminKey === void 0 || url === void 0) {
    const msg = "Unknown error during authorization: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  return { adminKey, deploymentUrl: url, deploymentName };
}
async function fetchExistingDevDeploymentCredentialsOrCrash(ctx, deploymentName) {
  const slugs = await fetchTeamAndProject(ctx, deploymentName);
  const credentials = await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
    ctx,
    {
      kind: "teamAndProjectSlugs",
      teamSlug: slugs.team,
      projectSlug: slugs.project
    },
    "dev"
  );
  return {
    deploymentName: credentials.deploymentName,
    adminKey: credentials.adminKey,
    url: credentials.deploymentUrl,
    deploymentType: "dev"
  };
}
async function handleOwnDev(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      if (projectSelection.deploymentType === "local") {
        const credentials = await loadLocalDeploymentCredentials(
          ctx,
          projectSelection.deploymentName
        );
        return {
          deploymentName: projectSelection.deploymentName,
          adminKey: credentials.adminKey,
          url: credentials.deploymentUrl,
          deploymentType: "local"
        };
      }
      return await fetchExistingDevDeploymentCredentialsOrCrash(
        ctx,
        projectSelection.deploymentName
      );
    }
    case "teamAndProjectSlugs":
    case "projectDeployKey": {
      const credentials = await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
        ctx,
        projectSelection,
        "dev"
      );
      return {
        url: credentials.deploymentUrl,
        adminKey: credentials.adminKey,
        deploymentName: credentials.deploymentName,
        deploymentType: "dev"
      };
    }
    default: {
      projectSelection;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        // This should be unreachable, so don't bother with a printed message.
        printedMessage: null,
        errForSentry: `Unexpected project selection: ${projectSelection.kind}`
      });
    }
  }
}
async function handleProd(ctx, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName": {
      const credentials = await bigBrainAPI({
        ctx,
        method: "POST",
        url: "deployment/authorize_prod",
        data: {
          deploymentName: projectSelection.deploymentName
        }
      });
      return credentials;
    }
    case "teamAndProjectSlugs":
    case "projectDeployKey": {
      const credentials = await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
        ctx,
        projectSelection,
        "prod"
      );
      return {
        url: credentials.deploymentUrl,
        adminKey: credentials.adminKey,
        deploymentName: credentials.deploymentName,
        deploymentType: "prod"
      };
    }
  }
}
async function handlePreview(ctx, previewName, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName":
    case "teamAndProjectSlugs":
      return await bigBrainAPI({
        ctx,
        method: "POST",
        url: "deployment/authorize_preview",
        data: {
          previewName,
          projectSelection
        }
      });
    case "projectDeployKey":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Project deploy keys are not supported for preview deployments"
      });
  }
}
async function handleDeploymentName(ctx, deploymentName, projectSelection) {
  switch (projectSelection.kind) {
    case "deploymentName":
    case "teamAndProjectSlugs":
      return await bigBrainAPI({
        ctx,
        method: "POST",
        url: "deployment/authorize_within_current_project",
        data: {
          selectedDeploymentName: deploymentName,
          projectSelection
        }
      });
    case "projectDeployKey":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Project deploy keys are not supported with the --deployment-name flag"
      });
  }
}
async function fetchDeploymentCredentialsWithinCurrentProject(ctx, projectSelection, deploymentSelection) {
  switch (deploymentSelection.kind) {
    case "ownDev": {
      return await handleOwnDev(ctx, projectSelection);
    }
    case "implicitProd":
    case "prod": {
      return await handleProd(ctx, projectSelection);
    }
    case "previewName":
      return await handlePreview(
        ctx,
        deploymentSelection.previewName,
        projectSelection
      );
    case "deploymentName":
      return await handleDeploymentName(
        ctx,
        deploymentSelection.deploymentName,
        projectSelection
      );
    default: {
      deploymentSelection;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        // This should be unreachable, so don't bother with a printed message.
        printedMessage: null,
        errForSentry: `Unexpected deployment selection: ${deploymentSelection}`
      });
    }
  }
}
async function _loadExistingDeploymentCredentialsForProject(ctx, targetProject, deploymentSelection, { ensureLocalRunning } = { ensureLocalRunning: true }) {
  const accessResult = await checkAccessToSelectedProject(ctx, targetProject);
  if (accessResult.kind === "noAccess") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "You don't have access to the selected project. Run `npx convex dev` to select a different project."
    });
  }
  const result = await fetchDeploymentCredentialsWithinCurrentProject(
    ctx,
    targetProject,
    deploymentSelection
  );
  logVerbose(
    `Deployment URL: ${result.url}, Deployment Name: ${result.deploymentName}, Deployment Type: ${result.deploymentType}`
  );
  if (ensureLocalRunning && result.deploymentType === "local") {
    await assertLocalBackendRunning(ctx, {
      url: result.url,
      deploymentName: result.deploymentName
    });
  }
  return {
    ...result,
    deploymentFields: {
      deploymentName: result.deploymentName,
      deploymentType: result.deploymentType,
      projectSlug: accessResult.kind === "hasAccess" ? accessResult.projectSlug : null,
      teamSlug: accessResult.kind === "hasAccess" ? accessResult.teamSlug : null
    }
  };
}
export async function loadSelectedDeploymentCredentials(ctx, deploymentSelection, selectionWithinProject, { ensureLocalRunning } = { ensureLocalRunning: true }) {
  switch (deploymentSelection.kind) {
    case "existingDeployment":
      await validateDeploymentSelectionForExistingDeployment(
        ctx,
        selectionWithinProject,
        deploymentSelection.deploymentToActOn.source
      );
      logVerbose(
        `Deployment URL: ${deploymentSelection.deploymentToActOn.url}, Deployment Name: ${deploymentSelection.deploymentToActOn.deploymentFields?.deploymentName ?? "unknown"}, Deployment Type: ${deploymentSelection.deploymentToActOn.deploymentFields?.deploymentType ?? "unknown"}`
      );
      return {
        adminKey: deploymentSelection.deploymentToActOn.adminKey,
        url: deploymentSelection.deploymentToActOn.url,
        deploymentFields: deploymentSelection.deploymentToActOn.deploymentFields
      };
    case "chooseProject":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project"
      });
    case "preview": {
      const slugs = await getTeamAndProjectFromPreviewAdminKey(
        ctx,
        deploymentSelection.previewDeployKey
      );
      return await _loadExistingDeploymentCredentialsForProject(
        ctx,
        {
          kind: "teamAndProjectSlugs",
          teamSlug: slugs.teamSlug,
          projectSlug: slugs.projectSlug
        },
        selectionWithinProject,
        { ensureLocalRunning }
      );
    }
    case "deploymentWithinProject": {
      return await _loadExistingDeploymentCredentialsForProject(
        ctx,
        deploymentSelection.targetProject,
        selectionWithinProject,
        { ensureLocalRunning }
      );
    }
    case "anonymous": {
      if (deploymentSelection.deploymentName === null) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project"
        });
      }
      const config = await loadAnonymousDeployment(
        ctx,
        deploymentSelection.deploymentName
      );
      const url = localDeploymentUrl(config.ports.cloud);
      if (ensureLocalRunning) {
        await assertLocalBackendRunning(ctx, {
          url,
          deploymentName: deploymentSelection.deploymentName
        });
      }
      return {
        adminKey: config.adminKey,
        url,
        deploymentFields: {
          deploymentName: deploymentSelection.deploymentName,
          deploymentType: "anonymous",
          projectSlug: null,
          teamSlug: null
        }
      };
    }
    default: {
      deploymentSelection;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Unknown deployment type"
      });
    }
  }
}
export async function fetchTeamAndProject(ctx, deploymentName) {
  const data = await bigBrainAPI({
    ctx,
    method: "GET",
    url: `deployment/${deploymentName}/team_and_project`
  });
  const { team, project } = data;
  if (team === void 0 || project === void 0) {
    const msg = "Unknown error when fetching team and project: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  return data;
}
export async function fetchTeamAndProjectForKey(ctx, deployKey) {
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: `deployment/team_and_project_for_key`,
    data: {
      deployKey
    }
  });
  const { team, project } = data;
  if (team === void 0 || project === void 0) {
    const msg = "Unknown error when fetching team and project: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg
    });
  }
  return data;
}
export async function getTeamsForUser(ctx) {
  const teams = await bigBrainAPI(
    {
      ctx,
      method: "GET",
      url: "teams"
    }
  );
  return teams;
}
//# sourceMappingURL=api.js.map
