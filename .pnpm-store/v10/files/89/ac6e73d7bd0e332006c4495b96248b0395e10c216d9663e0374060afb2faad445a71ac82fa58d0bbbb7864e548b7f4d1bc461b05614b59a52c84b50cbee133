import { Context } from "../../bundler/context.js";
import { logVerbose, logWarning } from "../../bundler/log.js";
import { getTeamAndProjectFromPreviewAdminKey } from "./deployment.js";
import {
  assertLocalBackendRunning,
  localDeploymentUrl,
} from "./localDeployment/run.js";
import {
  ThrowingFetchError,
  bigBrainAPI,
  bigBrainAPIMaybeThrows,
  logAndHandleFetchError,
} from "./utils/utils.js";
import { z } from "zod";
import {
  DeploymentSelection,
  ProjectSelection,
} from "./deploymentSelection.js";
import { loadLocalDeploymentCredentials } from "./localDeployment/localDeployment.js";
import { loadAnonymousDeployment } from "./localDeployment/anonymous.js";
export type DeploymentName = string;
export type CloudDeploymentType = "prod" | "dev" | "preview";
export type AccountRequiredDeploymentType = CloudDeploymentType | "local";
export type DeploymentType = AccountRequiredDeploymentType | "anonymous";

export type Project = {
  id: number;
  name: string;
  slug: string;
  isDemo: boolean;
};

type AdminKey = string;

// Provision a new project, creating a deployment of type `deploymentTypeToProvision`
export async function createProject(
  ctx: Context,
  {
    teamSlug: selectedTeamSlug,
    projectName,
    deploymentTypeToProvision,
  }: {
    teamSlug: string;
    projectName: string;
    deploymentTypeToProvision: "prod" | "dev";
  },
): Promise<{
  projectSlug: string;
  teamSlug: string;
  projectsRemaining: number;
}> {
  const provisioningArgs = {
    team: selectedTeamSlug,
    projectName,
    // TODO: Consider allowing projects with no deployments, or consider switching
    // to provisioning prod on creation.
    deploymentType: deploymentTypeToProvision,
  };
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "create_project",
    data: provisioningArgs,
  });
  const { projectSlug, teamSlug, projectsRemaining } = data;
  if (
    projectSlug === undefined ||
    teamSlug === undefined ||
    projectsRemaining === undefined
  ) {
    const error =
      "Unexpected response during provisioning: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: error,
      printedMessage: error,
    });
  }
  return {
    projectSlug,
    teamSlug,
    projectsRemaining,
  };
}

// ----------------------------------------------------------------------
// Helpers for `deploymentSelectionFromOptions`
// ----------------------------------------------------------------------

export const deploymentSelectionWithinProjectSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("previewName"), previewName: z.string() }),
    z.object({ kind: z.literal("deploymentName"), deploymentName: z.string() }),
    z.object({ kind: z.literal("prod") }),
    z.object({ kind: z.literal("implicitProd") }),
    z.object({ kind: z.literal("ownDev") }),
  ],
);

export type DeploymentSelectionWithinProject = z.infer<
  typeof deploymentSelectionWithinProjectSchema
>;

type DeploymentSelectionOptionsWithinProject = {
  prod?: boolean | undefined;
  // Whether this command defaults to prod when no other flags are provided. If
  // this is not set, the default will be "ownDev"
  implicitProd?: boolean;

  previewName?: string | undefined;
  deploymentName?: string | undefined;
};

export type DeploymentSelectionOptions =
  DeploymentSelectionOptionsWithinProject & {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
  };

export function deploymentSelectionWithinProjectFromOptions(
  options: DeploymentSelectionOptions,
): DeploymentSelectionWithinProject {
  if (options.previewName !== undefined) {
    return { kind: "previewName", previewName: options.previewName };
  }
  if (options.deploymentName !== undefined) {
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

export async function validateDeploymentSelectionForExistingDeployment(
  ctx: Context,
  deploymentSelection: DeploymentSelectionWithinProject,
  source: "selfHosted" | "deployKey" | "cliArgs",
) {
  if (
    deploymentSelection.kind === "ownDev" ||
    deploymentSelection.kind === "implicitProd"
  ) {
    // These are both considered the "default" selection depending on the command, so this is always fine
    return;
  }
  switch (source) {
    case "selfHosted":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "The `--prod`, `--preview-name`, and `--deployment-name` flags cannot be used with a self-hosted deployment.",
      });
    case "deployKey":
      logWarning(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags and using deployment from CONVEX_DEPLOY_KEY",
      );
      break;
    case "cliArgs":
      logWarning(
        "Ignoring `--prod`, `--preview-name`, or `--deployment-name` flags since this command was run with --url and --admin-key",
      );
      break;
  }
}

// ----------------------------------------------------------------------
// Helpers for `checkAccessToSelectedProject`
// ----------------------------------------------------------------------

async function hasAccessToProject(
  ctx: Context,
  selector: { projectSlug: string; teamSlug: string },
): Promise<boolean> {
  try {
    await bigBrainAPIMaybeThrows({
      ctx,
      url: `teams/${selector.teamSlug}/projects/${selector.projectSlug}/deployments`,
      method: "GET",
    });
    return true;
  } catch (err) {
    if (
      err instanceof ThrowingFetchError &&
      (err.serverErrorData?.code === "TeamNotFound" ||
        err.serverErrorData?.code === "ProjectNotFound")
    ) {
      return false;
    }
    return logAndHandleFetchError(ctx, err);
  }
}

export async function checkAccessToSelectedProject(
  ctx: Context,
  projectSelection: ProjectSelection,
): Promise<
  | { kind: "hasAccess"; teamSlug: string; projectSlug: string }
  | { kind: "noAccess" }
  | { kind: "unknown" }
> {
  switch (projectSelection.kind) {
    case "deploymentName": {
      const result = await getTeamAndProjectSlugForDeployment(ctx, {
        deploymentName: projectSelection.deploymentName,
      });
      if (result === null) {
        return { kind: "noAccess" };
      }
      return {
        kind: "hasAccess",
        teamSlug: result.teamSlug,
        projectSlug: result.projectSlug,
      };
    }
    case "teamAndProjectSlugs": {
      const hasAccess = await hasAccessToProject(ctx, {
        teamSlug: projectSelection.teamSlug,
        projectSlug: projectSelection.projectSlug,
      });
      if (!hasAccess) {
        return { kind: "noAccess" };
      }
      return {
        kind: "hasAccess",
        teamSlug: projectSelection.teamSlug,
        projectSlug: projectSelection.projectSlug,
      };
    }
    case "projectDeployKey":
      // Ideally we would be able to do an explicit check here, but if the key is invalid,
      // it will instead fail as soon as we try to use the key.
      return { kind: "unknown" };
    default: {
      projectSelection satisfies never;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Invalid project selection: ${(projectSelection as any).kind}`,
      });
    }
  }
}

export async function getTeamAndProjectSlugForDeployment(
  ctx: Context,
  selector: { deploymentName: string },
): Promise<{ teamSlug: string; projectSlug: string } | null> {
  try {
    const body = await bigBrainAPIMaybeThrows({
      ctx,
      url: `deployment/${selector.deploymentName}/team_and_project`,
      method: "GET",
    });
    return { teamSlug: body.team, projectSlug: body.project };
  } catch (err) {
    if (
      err instanceof ThrowingFetchError &&
      (err.serverErrorData?.code === "DeploymentNotFound" ||
        err.serverErrorData?.code === "ProjectNotFound")
    ) {
      return null;
    }
    return logAndHandleFetchError(ctx, err);
  }
}

// ----------------------------------------------------------------------
// Helpers for fetching deployment credentials
// ----------------------------------------------------------------------

// Used by dev for upgrade from team and project in convex.json to CONVEX_DEPLOYMENT
export async function fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
  ctx: Context,
  projectSelection:
    | { kind: "teamAndProjectSlugs"; teamSlug: string; projectSlug: string }
    | { kind: "projectDeployKey"; projectDeployKey: string },
  deploymentType: "prod" | "dev",
): Promise<{
  deploymentName: string;
  deploymentUrl: string;
  adminKey: AdminKey;
}> {
  if (projectSelection.kind === "projectDeployKey") {
    const auth = ctx.bigBrainAuth();
    const doesAuthMatch =
      auth !== null &&
      auth.kind === "projectKey" &&
      auth.projectKey === projectSelection.projectDeployKey;
    if (!doesAuthMatch) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: new Error(
          "Expected project deploy key to match the big brain auth header",
        ),
        printedMessage: "Unexpected error when loading the Convex deployment",
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
        teamSlug:
          projectSelection.kind === "teamAndProjectSlugs"
            ? projectSelection.teamSlug
            : null,
        projectSlug:
          projectSelection.kind === "teamAndProjectSlugs"
            ? projectSelection.projectSlug
            : null,
        deploymentType: deploymentType === "prod" ? "prod" : "dev",
      },
    });
  } catch (error) {
    const msg = "Unknown error during authorization: " + error;
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg,
    });
  }
  const adminKey = data.adminKey;
  const url = data.url;
  const deploymentName = data.deploymentName;
  if (adminKey === undefined || url === undefined) {
    const msg = "Unknown error during authorization: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg,
    });
  }
  return { adminKey, deploymentUrl: url, deploymentName };
}

async function fetchExistingDevDeploymentCredentialsOrCrash(
  ctx: Context,
  deploymentName: DeploymentName,
): Promise<{
  deploymentName: string;
  adminKey: string;
  url: string;
  deploymentType: DeploymentType;
}> {
  const slugs = await fetchTeamAndProject(ctx, deploymentName);
  const credentials =
    await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
      ctx,
      {
        kind: "teamAndProjectSlugs",
        teamSlug: slugs.team,
        projectSlug: slugs.project,
      },
      "dev",
    );
  return {
    deploymentName: credentials.deploymentName,
    adminKey: credentials.adminKey,
    url: credentials.deploymentUrl,
    deploymentType: "dev",
  };
}

// ----------------------------------------------------------------------
// Helpers for `loadSelectedDeploymentCredentials`
// ----------------------------------------------------------------------

async function handleOwnDev(
  ctx: Context,
  projectSelection: ProjectSelection,
): Promise<{
  deploymentName: string;
  adminKey: string;
  url: string;
  deploymentType: DeploymentType;
}> {
  switch (projectSelection.kind) {
    case "deploymentName": {
      if (projectSelection.deploymentType === "local") {
        const credentials = await loadLocalDeploymentCredentials(
          ctx,
          projectSelection.deploymentName,
        );
        return {
          deploymentName: projectSelection.deploymentName,
          adminKey: credentials.adminKey,
          url: credentials.deploymentUrl,
          deploymentType: "local",
        };
      }
      return await fetchExistingDevDeploymentCredentialsOrCrash(
        ctx,
        projectSelection.deploymentName,
      );
    }
    case "teamAndProjectSlugs":
    case "projectDeployKey": {
      // Note -- this provisions a dev deployment if one doesn't exist
      const credentials =
        await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
          ctx,
          projectSelection,
          "dev",
        );
      return {
        url: credentials.deploymentUrl,
        adminKey: credentials.adminKey,
        deploymentName: credentials.deploymentName,
        deploymentType: "dev",
      };
    }
    default: {
      projectSelection satisfies never;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        // This should be unreachable, so don't bother with a printed message.
        printedMessage: null,
        errForSentry: `Unexpected project selection: ${(projectSelection as any).kind}`,
      });
    }
  }
}

async function handleProd(
  ctx: Context,
  projectSelection: ProjectSelection,
): Promise<{
  deploymentName: string;
  adminKey: string;
  url: string;
  deploymentType: "prod";
}> {
  switch (projectSelection.kind) {
    case "deploymentName": {
      const credentials = await bigBrainAPI({
        ctx,
        method: "POST",
        url: "deployment/authorize_prod",
        data: {
          deploymentName: projectSelection.deploymentName,
        },
      });
      return credentials;
    }
    case "teamAndProjectSlugs":
    case "projectDeployKey": {
      const credentials =
        await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
          ctx,
          projectSelection,
          "prod",
        );
      return {
        url: credentials.deploymentUrl,
        adminKey: credentials.adminKey,
        deploymentName: credentials.deploymentName,
        deploymentType: "prod",
      };
    }
  }
}

async function handlePreview(
  ctx: Context,
  previewName: string,
  projectSelection: ProjectSelection,
): Promise<{
  deploymentName: string;
  adminKey: string;
  url: string;
  deploymentType: "preview";
}> {
  switch (projectSelection.kind) {
    case "deploymentName":
    case "teamAndProjectSlugs":
      return await bigBrainAPI({
        ctx,
        method: "POST",
        url: "deployment/authorize_preview",
        data: {
          previewName: previewName,
          projectSelection: projectSelection,
        },
      });

    case "projectDeployKey":
      // TODO -- this should be supported
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "Project deploy keys are not supported for preview deployments",
      });
  }
}

async function handleDeploymentName(
  ctx: Context,
  deploymentName: string,
  projectSelection: ProjectSelection,
): Promise<{
  deploymentName: string;
  adminKey: string;
  url: string;
  deploymentType: DeploymentType;
}> {
  switch (projectSelection.kind) {
    case "deploymentName":
    case "teamAndProjectSlugs":
      return await bigBrainAPI({
        ctx,
        method: "POST",
        url: "deployment/authorize_within_current_project",
        data: {
          selectedDeploymentName: deploymentName,
          projectSelection: projectSelection,
        },
      });
    case "projectDeployKey":
      // TODO -- this should be supported
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "Project deploy keys are not supported with the --deployment-name flag",
      });
  }
}

async function fetchDeploymentCredentialsWithinCurrentProject(
  ctx: Context,
  projectSelection: ProjectSelection,
  deploymentSelection: DeploymentSelectionWithinProject,
): Promise<{
  deploymentName: string;
  adminKey: string;
  url: string;
  deploymentType: DeploymentType;
}> {
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
        projectSelection,
      );
    case "deploymentName":
      return await handleDeploymentName(
        ctx,
        deploymentSelection.deploymentName,
        projectSelection,
      );
    default: {
      deploymentSelection satisfies never;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        // This should be unreachable, so don't bother with a printed message.
        printedMessage: null,
        errForSentry: `Unexpected deployment selection: ${deploymentSelection as any}`,
      });
    }
  }
}

async function _loadExistingDeploymentCredentialsForProject(
  ctx: Context,
  targetProject: ProjectSelection,
  deploymentSelection: DeploymentSelectionWithinProject,
  { ensureLocalRunning } = { ensureLocalRunning: true },
): Promise<{
  adminKey: string;
  url: string;
  deploymentFields: {
    deploymentName: string;
    deploymentType: DeploymentType;
    projectSlug: string | null;
    teamSlug: string | null;
  } | null;
}> {
  const accessResult = await checkAccessToSelectedProject(ctx, targetProject);
  if (accessResult.kind === "noAccess") {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage:
        "You don't have access to the selected project. Run `npx convex dev` to select a different project.",
    });
  }
  const result = await fetchDeploymentCredentialsWithinCurrentProject(
    ctx,
    targetProject,
    deploymentSelection,
  );
  logVerbose(
    `Deployment URL: ${result.url}, Deployment Name: ${result.deploymentName}, Deployment Type: ${result.deploymentType}`,
  );
  if (ensureLocalRunning && result.deploymentType === "local") {
    await assertLocalBackendRunning(ctx, {
      url: result.url,
      deploymentName: result.deploymentName,
    });
  }
  return {
    ...result,
    deploymentFields: {
      deploymentName: result.deploymentName,
      deploymentType: result.deploymentType,

      projectSlug:
        accessResult.kind === "hasAccess" ? accessResult.projectSlug : null,
      teamSlug:
        accessResult.kind === "hasAccess" ? accessResult.teamSlug : null,
    },
  };
}

export type DetailedDeploymentCredentials = {
  adminKey: string;
  url: string;
  deploymentFields: {
    deploymentName: string;
    deploymentType: DeploymentType;
    projectSlug: string | null;
    teamSlug: string | null;
  } | null;
};

// This is used by most commands (notably not `dev` and `deploy`) to determine
// which deployment to act on, taking into account the deployment selection flags.
//
export async function loadSelectedDeploymentCredentials(
  ctx: Context,
  deploymentSelection: DeploymentSelection,
  selectionWithinProject: DeploymentSelectionWithinProject,
  { ensureLocalRunning } = { ensureLocalRunning: true },
): Promise<DetailedDeploymentCredentials> {
  switch (deploymentSelection.kind) {
    case "existingDeployment":
      await validateDeploymentSelectionForExistingDeployment(
        ctx,
        selectionWithinProject,
        deploymentSelection.deploymentToActOn.source,
      );
      // We're already set up.
      logVerbose(
        `Deployment URL: ${deploymentSelection.deploymentToActOn.url}, Deployment Name: ${deploymentSelection.deploymentToActOn.deploymentFields?.deploymentName ?? "unknown"}, Deployment Type: ${deploymentSelection.deploymentToActOn.deploymentFields?.deploymentType ?? "unknown"}`,
      );
      return {
        adminKey: deploymentSelection.deploymentToActOn.adminKey,
        url: deploymentSelection.deploymentToActOn.url,
        deploymentFields:
          deploymentSelection.deploymentToActOn.deploymentFields,
      };
    case "chooseProject":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project",
      });
    case "preview": {
      const slugs = await getTeamAndProjectFromPreviewAdminKey(
        ctx,
        deploymentSelection.previewDeployKey,
      );
      return await _loadExistingDeploymentCredentialsForProject(
        ctx,
        {
          kind: "teamAndProjectSlugs",
          teamSlug: slugs.teamSlug,
          projectSlug: slugs.projectSlug,
        },
        selectionWithinProject,
        { ensureLocalRunning },
      );
    }
    case "deploymentWithinProject": {
      return await _loadExistingDeploymentCredentialsForProject(
        ctx,
        deploymentSelection.targetProject,
        selectionWithinProject,
        { ensureLocalRunning },
      );
    }
    case "anonymous": {
      if (deploymentSelection.deploymentName === null) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage:
            "No CONVEX_DEPLOYMENT set, run `npx convex dev` to configure a Convex project",
        });
      }
      const config = await loadAnonymousDeployment(
        ctx,
        deploymentSelection.deploymentName,
      );
      const url = localDeploymentUrl(config.ports.cloud);
      if (ensureLocalRunning) {
        await assertLocalBackendRunning(ctx, {
          url,
          deploymentName: deploymentSelection.deploymentName,
        });
      }
      return {
        adminKey: config.adminKey,
        url,
        deploymentFields: {
          deploymentName: deploymentSelection.deploymentName,
          deploymentType: "anonymous",
          projectSlug: null,
          teamSlug: null,
        },
      };
    }
    default: {
      deploymentSelection satisfies never;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Unknown deployment type",
      });
    }
  }
}

export async function fetchTeamAndProject(
  ctx: Context,
  deploymentName: string,
) {
  const data = (await bigBrainAPI({
    ctx,
    method: "GET",
    url: `deployment/${deploymentName}/team_and_project`,
  })) as {
    team: string; // slug
    project: string; // slug
    teamId: number;
    projectId: number;
  };

  const { team, project } = data;
  if (team === undefined || project === undefined) {
    const msg =
      "Unknown error when fetching team and project: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg,
    });
  }

  return data;
}

export async function fetchTeamAndProjectForKey(
  ctx: Context,
  // Deployment deploy key, like `prod:happy-animal-123|<stuff>`
  deployKey: string,
) {
  const data = (await bigBrainAPI({
    ctx,
    method: "POST",
    url: `deployment/team_and_project_for_key`,
    data: {
      deployKey: deployKey,
    },
  })) as {
    team: string; // slug
    project: string; // slug
    teamId: number;
    projectId: number;
  };

  const { team, project } = data;
  if (team === undefined || project === undefined) {
    const msg =
      "Unknown error when fetching team and project: " + JSON.stringify(data);
    return await ctx.crash({
      exitCode: 1,
      errorType: "transient",
      errForSentry: new Error(msg),
      printedMessage: msg,
    });
  }

  return data;
}

export async function getTeamsForUser(ctx: Context) {
  const teams = await bigBrainAPI<{ id: number; name: string; slug: string }[]>(
    {
      ctx,
      method: "GET",
      url: "teams",
    },
  );
  return teams;
}
