import { BigBrainAuth, Context } from "../../bundler/context.js";
import { logVerbose } from "../../bundler/log.js";
import {
  AccountRequiredDeploymentType,
  DeploymentType,
  fetchTeamAndProjectForKey,
} from "./api.js";
import { readProjectConfig } from "./config.js";
import {
  deploymentNameFromAdminKeyOrCrash,
  deploymentTypeFromAdminKey,
  getDeploymentTypeFromConfiguredDeployment,
  isAnonymousDeployment,
  isDeploymentKey,
  isPreviewDeployKey,
  isProjectKey,
  stripDeploymentTypePrefix,
} from "./deployment.js";
import { getBuildEnvironment } from "./envvars.js";
import { readGlobalConfig } from "./utils/globalConfig.js";
import {
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
  CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME,
  CONVEX_SELF_HOSTED_URL_VAR_NAME,
  ENV_VAR_FILE_PATH,
  bigBrainAPI,
  processDeployKeyValue,
} from "./utils/utils.js";
import * as dotenv from "dotenv";

// ----------------------------------------------------------------------------
// Big Brain Auth
// ----------------------------------------------------------------------------

/**
 * The auth header can be a few different things:
 * * An access token (corresponds to device authorization, usually stored in `~/.convex/config.json`)
 * * A preview deploy key (set via the `CONVEX_DEPLOY_KEY` environment variable)
 * * A project key (set via the `CONVEX_DEPLOY_KEY` environment variable)
 * * A deployment key if a deployment key (set via `CONVEX_DEPLOY_KEY` environment variable)
 *
 * Project keys take precedence over the the access token.
 * Deployment keys take precedence over the the access token.
 * This makes using one of these keys while logged in or logged out work the same.
 *
 * We check for the `CONVEX_DEPLOY_KEY` in the `--env-file` if it's provided.
 * Otherwise, we check in the `.env` and `.env.local` files.
 *
 * If we later prompt for log in, we need to call `ctx.setBigBrainAuthHeader` to
 * update the value.
 *
 * @param ctx
 * @param envFile
 * @returns
 */
export async function initializeBigBrainAuth(
  ctx: Context,
  initialArgs: {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
  },
): Promise<void> {
  if (initialArgs.url !== undefined && initialArgs.adminKey !== undefined) {
    // Do not check any env vars if `url` and `adminKey` are specified via CLI
    ctx._updateBigBrainAuth(
      getBigBrainAuth(ctx, {
        previewDeployKey: null,
        projectKey: null,
        deploymentKey: null,
      }),
    );
    return;
  }
  if (initialArgs.envFile !== undefined) {
    const existingFile = ctx.fs.exists(initialArgs.envFile)
      ? ctx.fs.readUtf8File(initialArgs.envFile)
      : null;
    if (existingFile === null) {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: "env file does not exist",
      });
    }
    const config = dotenv.parse(existingFile);
    const rawDeployKey = config[CONVEX_DEPLOY_KEY_ENV_VAR_NAME];
    const deployKey = await processDeployKeyValue(ctx, rawDeployKey);
    if (deployKey !== undefined) {
      const bigBrainAuth = getBigBrainAuth(ctx, {
        previewDeployKey: isPreviewDeployKey(deployKey) ? deployKey : null,
        projectKey: isProjectKey(deployKey) ? deployKey : null,
        deploymentKey: isDeploymentKey(deployKey) ? deployKey : null,
      });
      ctx._updateBigBrainAuth(bigBrainAuth);
    }
    return;
  }
  dotenv.config({ path: ENV_VAR_FILE_PATH });
  dotenv.config();
  const rawDeployKey = process.env[CONVEX_DEPLOY_KEY_ENV_VAR_NAME];
  const deployKey = await processDeployKeyValue(ctx, rawDeployKey);
  if (deployKey !== undefined) {
    const bigBrainAuth = getBigBrainAuth(ctx, {
      previewDeployKey: isPreviewDeployKey(deployKey) ? deployKey : null,
      projectKey: isProjectKey(deployKey) ? deployKey : null,
      deploymentKey: isDeploymentKey(deployKey) ? deployKey : null,
    });
    ctx._updateBigBrainAuth(bigBrainAuth);
    return;
  }
  ctx._updateBigBrainAuth(
    getBigBrainAuth(ctx, {
      previewDeployKey: null,
      projectKey: null,
      deploymentKey: null,
    }),
  );
  return;
}

export async function updateBigBrainAuthAfterLogin(
  ctx: Context,
  accessToken: string,
) {
  const existingAuth = ctx.bigBrainAuth();
  if (existingAuth !== null && existingAuth.kind === "projectKey") {
    logVerbose(
      `Ignoring update to big brain auth since project key takes precedence`,
    );
    return;
  }
  ctx._updateBigBrainAuth({
    accessToken: accessToken,
    kind: "accessToken",
    header: `Bearer ${accessToken}`,
  });
}

export async function clearBigBrainAuth(ctx: Context) {
  ctx._updateBigBrainAuth(null);
}

function getBigBrainAuth(
  ctx: Context,
  opts: {
    previewDeployKey: string | null;
    projectKey: string | null;
    deploymentKey: string | null;
  },
): BigBrainAuth | null {
  if (process.env.CONVEX_OVERRIDE_ACCESS_TOKEN) {
    return {
      accessToken: process.env.CONVEX_OVERRIDE_ACCESS_TOKEN,
      kind: "accessToken",
      header: `Bearer ${process.env.CONVEX_OVERRIDE_ACCESS_TOKEN}`,
    };
  }
  if (opts.projectKey !== null) {
    // Project keys take precedence over global config.
    return {
      header: `Bearer ${opts.projectKey}`,
      kind: "projectKey",
      projectKey: opts.projectKey,
    };
  }
  if (opts.deploymentKey !== null) {
    // Deployment keys take precedence over global config.
    return {
      header: `Bearer ${opts.deploymentKey}`,
      kind: "deploymentKey",
      deploymentKey: opts.deploymentKey,
    };
  }
  const globalConfig = readGlobalConfig(ctx);
  if (globalConfig) {
    return {
      kind: "accessToken",
      header: `Bearer ${globalConfig.accessToken}`,
      accessToken: globalConfig.accessToken,
    };
  }
  if (opts.previewDeployKey !== null) {
    return {
      header: `Bearer ${opts.previewDeployKey}`,
      kind: "previewDeployKey",
      previewDeployKey: opts.previewDeployKey,
    };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Deployment Selection
// ----------------------------------------------------------------------------
/**
 * Our CLI has logic to select which deployment to act on.
 *
 * We first check whether we're targeting a deployment within a project, or if we
 * know exactly which deployment to act on (e.g. in the case of self-hosting).
 *
 * We also special case preview deploys since the presence of a preview deploy key
 * triggers different behavior in `npx convex deploy`.
 *
 * Most commands will immediately compute the deployment selection, and then combine
 * that with any relevant CLI flags to figure out which deployment to talk to.
 *
 * Different commands do different things (e.g. `dev` will allow you to create a new project,
 * `deploy` has different behavior for preview deploys)
 *
 * This should be kept in sync with `initializeBigBrainAuth` since environment variables
 * like `CONVEX_DEPLOY_KEY` are used for both deployment selection and auth.
 */
export type DeploymentSelection =
  | {
      kind: "existingDeployment";
      deploymentToActOn: {
        url: string;
        adminKey: string;
        deploymentFields: {
          deploymentName: string;
          deploymentType: DeploymentType;
          projectSlug: string;
          teamSlug: string;
        } | null;
        source: "selfHosted" | "deployKey" | "cliArgs";
      };
    }
  | {
      kind: "deploymentWithinProject";
      targetProject: ProjectSelection;
    }
  | {
      kind: "preview";
      previewDeployKey: string;
    }
  | {
      kind: "chooseProject";
    }
  | {
      kind: "anonymous";
      deploymentName: string | null;
    };

export type ProjectSelection =
  | {
      kind: "teamAndProjectSlugs";
      teamSlug: string;
      projectSlug: string;
    }
  | {
      kind: "deploymentName";
      deploymentName: string;
      deploymentType: AccountRequiredDeploymentType | null;
    }
  | {
      kind: "projectDeployKey";
      projectDeployKey: string;
    };

export async function getDeploymentSelection(
  ctx: Context,
  cliArgs: {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
  },
): Promise<DeploymentSelection> {
  const metadata = await _getDeploymentSelection(ctx, cliArgs);
  logDeploymentSelection(ctx, metadata);
  return metadata;
}

function logDeploymentSelection(_ctx: Context, selection: DeploymentSelection) {
  switch (selection.kind) {
    case "existingDeployment": {
      logVerbose(
        `Existing deployment: ${selection.deploymentToActOn.url} ${selection.deploymentToActOn.source}`,
      );
      break;
    }
    case "deploymentWithinProject": {
      logVerbose(
        `Deployment within project: ${prettyProjectSelection(selection.targetProject)}`,
      );
      break;
    }
    case "preview": {
      logVerbose(`Preview deploy key`);
      break;
    }
    case "chooseProject": {
      logVerbose(`Choose project`);
      break;
    }
    case "anonymous": {
      logVerbose(
        `Anonymous, has selected deployment?: ${selection.deploymentName !== null}`,
      );
      break;
    }
    default: {
      selection satisfies never;
      logVerbose(`Unknown deployment selection`);
    }
  }
  return null;
}

function prettyProjectSelection(selection: ProjectSelection) {
  switch (selection.kind) {
    case "teamAndProjectSlugs": {
      return `Team and project slugs: ${selection.teamSlug} ${selection.projectSlug}`;
    }
    case "deploymentName": {
      return `Deployment name: ${selection.deploymentName}`;
    }
    case "projectDeployKey": {
      return `Project deploy key`;
    }
    default: {
      selection satisfies never;
      return `Unknown`;
    }
  }
}

async function _getDeploymentSelection(
  ctx: Context,
  cliArgs: {
    url?: string | undefined;
    adminKey?: string | undefined;
    envFile?: string | undefined;
  },
): Promise<DeploymentSelection> {
  /*
   - url + adminKey specified via CLI
   - Do not check any env vars (including ones relevant for auth)
  */
  if (cliArgs.url !== undefined && cliArgs.adminKey !== undefined) {
    return {
      kind: "existingDeployment",
      deploymentToActOn: {
        url: cliArgs.url,
        adminKey: cliArgs.adminKey,
        deploymentFields: null,
        source: "cliArgs",
      },
    };
  }

  if (cliArgs.envFile !== undefined) {
    // If an `--env-file` is specified, it must contain enough information for both auth and deployment selection.
    logVerbose(`Checking env file: ${cliArgs.envFile}`);
    const existingFile = ctx.fs.exists(cliArgs.envFile)
      ? ctx.fs.readUtf8File(cliArgs.envFile)
      : null;
    if (existingFile === null) {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: "env file does not exist",
      });
    }
    const config = dotenv.parse(existingFile);
    const result = await getDeploymentSelectionFromEnv(ctx, (name) =>
      config[name] === undefined || config[name] === "" ? null : config[name],
    );
    if (result.kind === "unknown") {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage:
          `env file \`${cliArgs.envFile}\` did not contain environment variables for a Convex deployment. ` +
          `Expected \`${CONVEX_DEPLOY_KEY_ENV_VAR_NAME}\`, \`${CONVEX_DEPLOYMENT_ENV_VAR_NAME}\`, or both \`${CONVEX_SELF_HOSTED_URL_VAR_NAME}\` and \`${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME}\` to be set.`,
      });
    }
    return result.metadata;
  }
  // start with .env.local (but doesn't override existing)
  dotenv.config({ path: ENV_VAR_FILE_PATH });
  // for variables not already set, use .env values
  dotenv.config();
  const result = await getDeploymentSelectionFromEnv(ctx, (name) => {
    const value = process.env[name];
    if (value === undefined || value === "") {
      return null;
    }
    return value;
  });
  if (result.kind !== "unknown") {
    return result.metadata;
  }
  // none of these?

  // Check the `convex.json` for a configured team and project
  const { projectConfig } = await readProjectConfig(ctx);
  if (projectConfig.team !== undefined && projectConfig.project !== undefined) {
    return {
      kind: "deploymentWithinProject",
      targetProject: {
        kind: "teamAndProjectSlugs",
        teamSlug: projectConfig.team,
        projectSlug: projectConfig.project,
      },
    };
  }

  // Check if they're logged in
  const isLoggedIn = ctx.bigBrainAuth() !== null;
  if (!isLoggedIn && shouldAllowAnonymousDevelopment()) {
    return {
      kind: "anonymous",
      deploymentName: null,
    };
  }

  // Choose a project interactively later
  return {
    kind: "chooseProject",
  };
}

async function getDeploymentSelectionFromEnv(
  ctx: Context,
  getEnv: (name: string) => string | null,
): Promise<
  { kind: "success"; metadata: DeploymentSelection } | { kind: "unknown" }
> {
  const rawDeployKey = getEnv(CONVEX_DEPLOY_KEY_ENV_VAR_NAME);
  const deployKey = await processDeployKeyValue(
    ctx,
    rawDeployKey === null ? undefined : rawDeployKey,
  );
  if (deployKey !== undefined) {
    const deployKeyType = isPreviewDeployKey(deployKey)
      ? "preview"
      : isProjectKey(deployKey)
        ? "project"
        : "deployment";
    switch (deployKeyType) {
      case "preview": {
        // `CONVEX_DEPLOY_KEY` is set to a preview deploy key so this takes precedence over anything else.
        // At the moment, we don't verify that there aren't other env vars that would also be used for deployment selection (e.g. `CONVEX_DEPLOYMENT`)
        return {
          kind: "success",
          metadata: {
            kind: "preview",
            previewDeployKey: deployKey,
          },
        };
      }
      case "project": {
        // `CONVEX_DEPLOY_KEY` is set to a project deploy key.
        // Commands can select any deployment within the project. At the moment we don't check for other env vars (e.g. `CONVEX_DEPLOYMENT`)
        return {
          kind: "success",
          metadata: {
            kind: "deploymentWithinProject",
            targetProject: {
              kind: "projectDeployKey",
              projectDeployKey: deployKey,
            },
          },
        };
      }
      case "deployment": {
        // `CONVEX_DEPLOY_KEY` is set to a deployment's deploy key.
        // Deploy to this deployment -- selectors like `--prod` / `--preview-name` will be ignored.
        // At the moment, we don't verify that there aren't other env vars that would also be used for deployment selection (e.g. `CONVEX_DEPLOYMENT`)
        const deploymentName = await deploymentNameFromAdminKeyOrCrash(
          ctx,
          deployKey,
        );
        const deploymentType = deploymentTypeFromAdminKey(deployKey);
        // We cannot derive the deployment URL from the deploy key, because it
        // might be a custom domain. Ask big brain for the URL.
        const url = await bigBrainAPI({
          ctx,
          method: "POST",
          url: "deployment/url_for_key",
          data: {
            deployKey: deployKey,
          },
        });
        const slugs = await fetchTeamAndProjectForKey(ctx, deployKey);
        return {
          kind: "success",
          metadata: {
            kind: "existingDeployment",
            deploymentToActOn: {
              url: url,
              adminKey: deployKey,
              deploymentFields: {
                deploymentName: deploymentName,
                deploymentType: deploymentType,
                teamSlug: slugs.team,
                projectSlug: slugs.project,
              },
              source: "deployKey",
            },
          },
        };
      }
      default: {
        deployKeyType satisfies never;
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Unexpected deploy key type: ${deployKeyType as any}`,
        });
      }
    }
  }

  const convexDeployment = getEnv(CONVEX_DEPLOYMENT_ENV_VAR_NAME);
  const selfHostedUrl = getEnv(CONVEX_SELF_HOSTED_URL_VAR_NAME);
  const selfHostedAdminKey = getEnv(CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME);

  if (selfHostedUrl !== null && selfHostedAdminKey !== null) {
    if (convexDeployment !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${CONVEX_DEPLOYMENT_ENV_VAR_NAME} must not be set when ${CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} are set`,
      });
    }
    return {
      kind: "success",
      metadata: {
        kind: "existingDeployment",
        deploymentToActOn: {
          url: selfHostedUrl,
          adminKey: selfHostedAdminKey,
          deploymentFields: null,
          source: "selfHosted",
        },
      },
    };
  }

  if (convexDeployment !== null) {
    if (selfHostedUrl !== null || selfHostedAdminKey !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} must not be set when ${CONVEX_DEPLOYMENT_ENV_VAR_NAME} is set`,
      });
    }
    const targetDeploymentType =
      getDeploymentTypeFromConfiguredDeployment(convexDeployment);
    const targetDeploymentName = stripDeploymentTypePrefix(convexDeployment);
    const isAnonymous = isAnonymousDeployment(targetDeploymentName);
    if (isAnonymous) {
      if (!shouldAllowAnonymousDevelopment()) {
        return {
          kind: "unknown",
        };
      }
      return {
        kind: "success",
        metadata: {
          kind: "anonymous",
          deploymentName: targetDeploymentName,
        },
      };
    }
    // Commands can select a deployment within the project that this deployment belongs to.
    return {
      kind: "success",
      metadata: {
        kind: "deploymentWithinProject",
        targetProject: {
          kind: "deploymentName",
          deploymentName: targetDeploymentName,
          deploymentType: targetDeploymentType,
        },
      },
    };
  }

  // Throw a nice error if we're in something like a CI environment where we need a valid deployment configuration
  await checkIfBuildEnvironmentRequiresDeploymentConfig(ctx);

  return { kind: "unknown" };
}

async function checkIfBuildEnvironmentRequiresDeploymentConfig(ctx: Context) {
  const buildEnvironment = getBuildEnvironment();
  if (buildEnvironment) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage:
        `${buildEnvironment} build environment detected but no Convex deployment configuration found.\n` +
        `Set one of:\n` +
        `  • ${CONVEX_DEPLOY_KEY_ENV_VAR_NAME} for Convex Cloud deployments\n` +
        `  • ${CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} for self-hosted deployments\n` +
        `See https://docs.convex.dev/production/hosting or https://docs.convex.dev/self-hosting`,
    });
  }
}

/**
 * Used for things like `npx convex docs` where we want to best effort extract a deployment name
 * but don't do the full deployment selection logic.
 */
export const deploymentNameFromSelection = (
  selection: DeploymentSelection,
): string | null => {
  return deploymentNameAndTypeFromSelection(selection)?.name ?? null;
};

export const deploymentNameAndTypeFromSelection = (
  selection: DeploymentSelection,
): { name: string | null; type: string | null } | null => {
  switch (selection.kind) {
    case "existingDeployment": {
      return {
        name:
          selection.deploymentToActOn.deploymentFields?.deploymentName ?? null,
        type:
          selection.deploymentToActOn.deploymentFields?.deploymentType ?? null,
      };
    }
    case "deploymentWithinProject": {
      return selection.targetProject.kind === "deploymentName"
        ? {
            name: selection.targetProject.deploymentName,
            type: selection.targetProject.deploymentType,
          }
        : null;
    }
    case "preview": {
      return null;
    }
    case "chooseProject": {
      return null;
    }
    case "anonymous": {
      return null;
    }
    default: {
      selection satisfies never;
    }
  }
  return null;
};

export const shouldAllowAnonymousDevelopment = (): boolean => {
  // Kill switch / temporary opt out
  if (process.env.CONVEX_ALLOW_ANONYMOUS === "false") {
    return false;
  }
  return true;
};
