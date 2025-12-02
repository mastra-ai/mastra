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
var api_exports = {};
__export(api_exports, {
  checkAccessToSelectedProject: () => checkAccessToSelectedProject,
  createProject: () => createProject,
  deploymentSelectionWithinProjectFromOptions: () => deploymentSelectionWithinProjectFromOptions,
  deploymentSelectionWithinProjectSchema: () => deploymentSelectionWithinProjectSchema,
  fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows: () => fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows,
  fetchTeamAndProject: () => fetchTeamAndProject,
  fetchTeamAndProjectForKey: () => fetchTeamAndProjectForKey,
  getTeamAndProjectSlugForDeployment: () => getTeamAndProjectSlugForDeployment,
  getTeamsForUser: () => getTeamsForUser,
  loadSelectedDeploymentCredentials: () => loadSelectedDeploymentCredentials,
  validateDeploymentSelectionForExistingDeployment: () => validateDeploymentSelectionForExistingDeployment
});
module.exports = __toCommonJS(api_exports);
var import_log = require("../../bundler/log.js");
var import_deployment = require("./deployment.js");
var import_run = require("./localDeployment/run.js");
var import_utils = require("./utils/utils.js");
var import_zod = require("zod");
var import_localDeployment = require("./localDeployment/localDeployment.js");
var import_anonymous = require("./localDeployment/anonymous.js");
async function createProject(ctx, {
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
  const data = await (0, import_utils.bigBrainAPI)({
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
const deploymentSelectionWithinProjectSchema = import_zod.z.discriminatedUnion(
  "kind",
  [
    import_zod.z.object({ kind: import_zod.z.literal("previewName"), previewName: import_zod.z.string() }),
    import_zod.z.object({ kind: import_zod.z.literal("deploymentName"), deploymentName: import_zod.z.string() }),
    import_zod.z.object({ kind: import_zod.z.literal("prod") }),
    import_zod.z.object({ kind: import_zod.z.literal("implicitProd") }),
    import_zod.z.object({ kind: import_zod.z.literal("ownDev") })
  ]
);
function deploymentSelectionWithinProjectFromOptions(options) {
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
async function validateDeploymentSelectionForExistingDeployment(ctx, deploymentSelection, source) {
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
      (0, import_log.logWarning)(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags and using deployment from CONVEX_DEPLOY_KEY"
      );
      break;
    case "cliArgs":
      (0, import_log.logWarning)(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags since this command was run with --url and --admin-key"
      );
      break;
  }
}
async function hasAccessToProject(ctx, selector) {
  try {
    await (0, import_utils.bigBrainAPIMaybeThrows)({
      ctx,
      url: `teams/${selector.teamSlug}/projects/${selector.projectSlug}/deployments`,
      method: "GET"
    });
    return true;
  } catch (err) {
    if (err instanceof import_utils.ThrowingFetchError && (err.serverErrorData?.code === "TeamNotFound" || err.serverErrorData?.code === "ProjectNotFound")) {
      return false;
    }
    return (0, import_utils.logAndHandleFetchError)(ctx, err);
  }
}
async function checkAccessToSelectedProject(ctx, projectSelection) {
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
async function getTeamAndProjectSlugForDeployment(ctx, selector) {
  try {
    const body = await (0, import_utils.bigBrainAPIMaybeThrows)({
      ctx,
      url: `deployment/${selector.deploymentName}/team_and_project`,
      method: "GET"
    });
    return { teamSlug: body.team, projectSlug: body.project };
  } catch (err) {
    if (err instanceof import_utils.ThrowingFetchError && (err.serverErrorData?.code === "DeploymentNotFound" || err.serverErrorData?.code === "ProjectNotFound")) {
      return null;
    }
    return (0, import_utils.logAndHandleFetchError)(ctx, err);
  }
}
async function fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(ctx, projectSelection, deploymentType) {
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
    data = await (0, import_utils.bigBrainAPIMaybeThrows)({
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
        const credentials = await (0, import_localDeployment.loadLocalDeploymentCredentials)(
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
      const credentials = await (0, import_utils.bigBrainAPI)({
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
      return await (0, import_utils.bigBrainAPI)({
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
      return await (0, import_utils.bigBrainAPI)({
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
  (0, import_log.logVerbose)(
    `Deployment URL: ${result.url}, Deployment Name: ${result.deploymentName}, Deployment Type: ${result.deploymentType}`
  );
  if (ensureLocalRunning && result.deploymentType === "local") {
    await (0, import_run.assertLocalBackendRunning)(ctx, {
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
async function loadSelectedDeploymentCredentials(ctx, deploymentSelection, selectionWithinProject, { ensureLocalRunning } = { ensureLocalRunning: true }) {
  switch (deploymentSelection.kind) {
    case "existingDeployment":
      await validateDeploymentSelectionForExistingDeployment(
        ctx,
        selectionWithinProject,
        deploymentSelection.deploymentToActOn.source
      );
      (0, import_log.logVerbose)(
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
      const slugs = await (0, import_deployment.getTeamAndProjectFromPreviewAdminKey)(
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
      const config = await (0, import_anonymous.loadAnonymousDeployment)(
        ctx,
        deploymentSelection.deploymentName
      );
      const url = (0, import_run.localDeploymentUrl)(config.ports.cloud);
      if (ensureLocalRunning) {
        await (0, import_run.assertLocalBackendRunning)(ctx, {
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
async function fetchTeamAndProject(ctx, deploymentName) {
  const data = await (0, import_utils.bigBrainAPI)({
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
async function fetchTeamAndProjectForKey(ctx, deployKey) {
  const data = await (0, import_utils.bigBrainAPI)({
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
async function getTeamsForUser(ctx) {
  const teams = await (0, import_utils.bigBrainAPI)(
    {
      ctx,
      method: "GET",
      url: "teams"
    }
  );
  return teams;
}
//# sourceMappingURL=api.js.map
