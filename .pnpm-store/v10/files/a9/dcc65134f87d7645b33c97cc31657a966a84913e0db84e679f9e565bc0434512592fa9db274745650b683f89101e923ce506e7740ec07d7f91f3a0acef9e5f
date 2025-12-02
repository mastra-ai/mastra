import chalk from "chalk";
import { Context } from "../bundler/context.js";
import {
  logFailure,
  logFinishedStep,
  logMessage,
  logWarning,
  showSpinner,
} from "../bundler/log.js";
import {
  DeploymentType,
  DeploymentName,
  fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows,
  createProject,
  DeploymentSelectionWithinProject,
  loadSelectedDeploymentCredentials,
  checkAccessToSelectedProject,
  validateDeploymentSelectionForExistingDeployment,
} from "./lib/api.js";
import {
  configName,
  readProjectConfig,
  upgradeOldAuthInfoToAuthConfig,
  writeProjectConfig,
} from "./lib/config.js";
import {
  DeploymentDetails,
  eraseDeploymentEnvVar,
  writeDeploymentEnvVar,
} from "./lib/deployment.js";
import { finalizeConfiguration } from "./lib/init.js";
import {
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  functionsDir,
  hasProjects,
  logAndHandleFetchError,
  selectDevDeploymentType,
  validateOrSelectProject,
  validateOrSelectTeam,
} from "./lib/utils/utils.js";
import { writeConvexUrlToEnvFile } from "./lib/envvars.js";
import path from "path";
import { projectDashboardUrl } from "./lib/dashboard.js";
import { doCodegen, doCodegenForNewProject } from "./lib/codegen.js";
import { handleLocalDeployment } from "./lib/localDeployment/localDeployment.js";
import {
  promptOptions,
  promptString,
  promptYesNo,
} from "./lib/utils/prompts.js";
import { readGlobalConfig } from "./lib/utils/globalConfig.js";
import {
  DeploymentSelection,
  ProjectSelection,
  deploymentNameFromSelection,
  shouldAllowAnonymousDevelopment,
} from "./lib/deploymentSelection.js";
import { ensureLoggedIn } from "./lib/login.js";
import { handleAnonymousDeployment } from "./lib/localDeployment/anonymous.js";
type DeploymentCredentials = {
  url: string;
  adminKey: string;
};

type ChosenConfiguration =
  // `--configure new`
  | "new"
  // `--configure existing`
  | "existing"
  // `--configure`
  | "ask"
  // `--configure` was not specified
  | null;

type ConfigureCmdOptions = {
  selectionWithinProject: DeploymentSelectionWithinProject;
  prod: boolean;
  localOptions: {
    ports?: {
      cloud: number;
      site: number;
    };
    backendVersion?: string | undefined;
    dashboardVersion?: string | undefined;
    forceUpgrade: boolean;
  };
  team?: string | undefined;
  project?: string | undefined;
  devDeployment?: "cloud" | "local" | undefined;
  local?: boolean | undefined;
  cloud?: boolean | undefined;
  url?: string | undefined;
  adminKey?: string | undefined;
  envFile?: string | undefined;
  overrideAuthUrl?: string | undefined;
  overrideAuthClient?: string | undefined;
  overrideAuthUsername?: string | undefined;
  overrideAuthPassword?: string | undefined;
};

/**
 * As of writing, this is used by:
 * - `npx convex dev`
 * - `npx convex codegen`
 *
 * But is not used by `npx convex deploy` or other commands.
 */
export async function deploymentCredentialsOrConfigure(
  ctx: Context,
  deploymentSelection: DeploymentSelection,
  chosenConfiguration: ChosenConfiguration,
  cmdOptions: ConfigureCmdOptions,
): Promise<
  DeploymentCredentials & {
    deploymentFields: {
      deploymentName: DeploymentName;
      deploymentType: string;
      projectSlug: string | null;
      teamSlug: string | null;
    } | null;
  }
> {
  const selectedDeployment = await _deploymentCredentialsOrConfigure(
    ctx,
    deploymentSelection,
    chosenConfiguration,
    cmdOptions,
  );

  if (selectedDeployment.deploymentFields !== null) {
    // Set the `CONVEX_DEPLOYMENT` env var + the `CONVEX_URL` env var
    await updateEnvAndConfigForDeploymentSelection(
      ctx,
      {
        url: selectedDeployment.url,
        deploymentName: selectedDeployment.deploymentFields.deploymentName,
        teamSlug: selectedDeployment.deploymentFields.teamSlug,
        projectSlug: selectedDeployment.deploymentFields.projectSlug,
        deploymentType: selectedDeployment.deploymentFields.deploymentType,
      },
      deploymentNameFromSelection(deploymentSelection),
    );
  } else {
    // Clear the `CONVEX_DEPLOYMENT` env var + set the `CONVEX_URL` env var
    await handleManuallySetUrlAndAdminKey(ctx, {
      url: selectedDeployment.url,
      adminKey: selectedDeployment.adminKey,
    });
  }
  return {
    url: selectedDeployment.url,
    adminKey: selectedDeployment.adminKey,
    deploymentFields: selectedDeployment.deploymentFields,
  };
}

export async function _deploymentCredentialsOrConfigure(
  ctx: Context,
  deploymentSelection: DeploymentSelection,
  chosenConfiguration: ChosenConfiguration,
  cmdOptions: ConfigureCmdOptions,
): Promise<
  DeploymentCredentials & {
    deploymentFields: {
      deploymentName: DeploymentName;
      deploymentType: DeploymentType;
      projectSlug: string | null;
      teamSlug: string | null;
    } | null;
  }
> {
  const config = readGlobalConfig(ctx);
  const globallyForceCloud = !!config?.optOutOfLocalDevDeploymentsUntilBetaOver;
  if (globallyForceCloud && cmdOptions.local) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage:
        "Can't specify --local when local deployments are disabled on this machine. Run `npx convex disable-local-deployments --undo-global` to allow use of --local.",
    });
  }

  switch (deploymentSelection.kind) {
    case "existingDeployment":
      await validateDeploymentSelectionForExistingDeployment(
        ctx,
        cmdOptions.selectionWithinProject,
        deploymentSelection.deploymentToActOn.source,
      );
      if (deploymentSelection.deploymentToActOn.deploymentFields === null) {
        // erase `CONVEX_DEPLOYMENT` from .env.local + set the url env var
        await handleManuallySetUrlAndAdminKey(ctx, {
          url: deploymentSelection.deploymentToActOn.url,
          adminKey: deploymentSelection.deploymentToActOn.adminKey,
        });
      }
      return {
        url: deploymentSelection.deploymentToActOn.url,
        adminKey: deploymentSelection.deploymentToActOn.adminKey,
        deploymentFields:
          deploymentSelection.deploymentToActOn.deploymentFields,
      };
    case "chooseProject": {
      await ensureLoggedIn(ctx, {
        overrideAuthUrl: cmdOptions.overrideAuthUrl,
        overrideAuthClient: cmdOptions.overrideAuthClient,
        overrideAuthUsername: cmdOptions.overrideAuthUsername,
        overrideAuthPassword: cmdOptions.overrideAuthPassword,
      });
      return await handleChooseProject(
        ctx,
        chosenConfiguration,
        {
          globallyForceCloud,
        },
        cmdOptions,
      );
    }
    case "preview":
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Use `npx convex deploy` to use preview deployments.",
      });
    case "deploymentWithinProject": {
      return await handleDeploymentWithinProject(ctx, {
        chosenConfiguration,
        targetProject: deploymentSelection.targetProject,
        cmdOptions,
        globallyForceCloud,
      });
    }
    case "anonymous": {
      const hasAuth = ctx.bigBrainAuth() !== null;
      if (hasAuth && deploymentSelection.deploymentName !== null) {
        const shouldConfigure =
          chosenConfiguration !== null ||
          (await promptYesNo(ctx, {
            message: `${CONVEX_DEPLOYMENT_ENV_VAR_NAME} is configured with deployment ${deploymentSelection.deploymentName}, which is not linked with your account. Would you like to choose a different project instead?`,
          }));
        if (!shouldConfigure) {
          return await ctx.crash({
            exitCode: 0,
            errorType: "fatal",
            printedMessage: `Run \`npx convex login --link-deployments\` first to link this deployment to your account, and then run \`npx convex dev\` again.`,
          });
        }
        return await handleChooseProject(
          ctx,
          chosenConfiguration,
          {
            globallyForceCloud,
          },
          cmdOptions,
        );
      }
      const alreadyHasConfiguredAnonymousDeployment =
        deploymentSelection.deploymentName !== null &&
        chosenConfiguration === null;
      const forceAnonymous = process.env.CONVEX_AGENT_MODE === "anonymous";
      if (forceAnonymous) {
        logWarning(
          chalk.yellow.bold(
            "CONVEX_AGENT_MODE=anonymous mode is in beta, functionality may change in the future.",
          ),
        );
      }

      const shouldPromptForLogin = forceAnonymous
        ? "no"
        : alreadyHasConfiguredAnonymousDeployment
          ? "no"
          : await promptOptions(ctx, {
              message:
                "Welcome to Convex! Would you like to login to your account?",
              choices: [
                {
                  name: "Start without an account (run Convex locally)",
                  value: "no",
                },
                { name: "Login or create an account", value: "yes" },
              ],
              default: "no",
            });
      if (shouldPromptForLogin === "no") {
        const result = await handleAnonymousDeployment(ctx, {
          chosenConfiguration,
          deploymentName: deploymentSelection.deploymentName,
          ...cmdOptions.localOptions,
        });
        return {
          adminKey: result.adminKey,
          url: result.deploymentUrl,
          deploymentFields: {
            deploymentName: result.deploymentName,
            deploymentType: "anonymous",
            projectSlug: null,
            teamSlug: null,
          },
        };
      }
      return await handleChooseProject(
        ctx,
        chosenConfiguration,
        {
          globallyForceCloud,
        },
        cmdOptions,
      );
    }
  }
}

async function handleDeploymentWithinProject(
  ctx: Context,
  {
    chosenConfiguration,
    targetProject,
    cmdOptions,
    globallyForceCloud,
  }: {
    chosenConfiguration: ChosenConfiguration;
    targetProject: ProjectSelection;
    cmdOptions: ConfigureCmdOptions;
    globallyForceCloud: boolean;
  },
) {
  const hasAuth = ctx.bigBrainAuth() !== null;
  const loginMessage =
    hasAuth && shouldAllowAnonymousDevelopment()
      ? undefined
      : `Tip: You can try out Convex without creating an account by clearing the ${CONVEX_DEPLOYMENT_ENV_VAR_NAME} environment variable.`;
  await ensureLoggedIn(ctx, {
    message: loginMessage,
    overrideAuthUrl: cmdOptions.overrideAuthUrl,
    overrideAuthClient: cmdOptions.overrideAuthClient,
    overrideAuthUsername: cmdOptions.overrideAuthUsername,
    overrideAuthPassword: cmdOptions.overrideAuthPassword,
  });
  if (chosenConfiguration !== null) {
    const result = await handleChooseProject(
      ctx,
      chosenConfiguration,
      {
        globallyForceCloud,
      },
      cmdOptions,
    );
    return result;
  }

  const accessResult = await checkAccessToSelectedProject(ctx, targetProject);
  if (accessResult.kind === "noAccess") {
    logMessage("You don't have access to the selected project.");
    const result = await handleChooseProject(
      ctx,
      chosenConfiguration,
      {
        globallyForceCloud,
      },
      cmdOptions,
    );
    return result;
  }

  const selectedDeployment = await loadSelectedDeploymentCredentials(
    ctx,
    {
      kind: "deploymentWithinProject",
      targetProject,
    },
    cmdOptions.selectionWithinProject,
    // We'll start running it below
    { ensureLocalRunning: false },
  );
  if (
    selectedDeployment.deploymentFields !== null &&
    selectedDeployment.deploymentFields.deploymentType === "local"
  ) {
    // Start running the local backend
    await handleLocalDeployment(ctx, {
      teamSlug: selectedDeployment.deploymentFields.teamSlug!,
      projectSlug: selectedDeployment.deploymentFields.projectSlug!,
      forceUpgrade: cmdOptions.localOptions.forceUpgrade,
      ports: cmdOptions.localOptions.ports,
      backendVersion: cmdOptions.localOptions.backendVersion,
    });
  }
  return {
    url: selectedDeployment.url,
    adminKey: selectedDeployment.adminKey,
    deploymentFields: selectedDeployment.deploymentFields,
  };
}

async function handleChooseProject(
  ctx: Context,
  chosenConfiguration: ChosenConfiguration,
  args: {
    globallyForceCloud: boolean;
  },
  cmdOptions: ConfigureCmdOptions,
): Promise<
  DeploymentCredentials & {
    deploymentFields: {
      deploymentName: DeploymentName;
      deploymentType: DeploymentType;
      projectSlug: string;
      teamSlug: string;
    };
  }
> {
  await ensureLoggedIn(ctx, {
    overrideAuthUrl: cmdOptions.overrideAuthUrl,
    overrideAuthClient: cmdOptions.overrideAuthClient,
    overrideAuthUsername: cmdOptions.overrideAuthUsername,
    overrideAuthPassword: cmdOptions.overrideAuthPassword,
  });
  const project = await selectProject(ctx, chosenConfiguration, {
    team: cmdOptions.team,
    project: cmdOptions.project,
    devDeployment: cmdOptions.devDeployment,
    local: args.globallyForceCloud ? false : cmdOptions.local,
    cloud: args.globallyForceCloud ? true : cmdOptions.cloud,
  });
  // TODO complain about any non-default cmdOptions.localOptions here
  // because we're ignoring them if this isn't a local development.

  const deploymentOptions: DeploymentOptions =
    cmdOptions.selectionWithinProject.kind === "prod"
      ? { kind: "prod" }
      : project.devDeployment === "local"
        ? { kind: "local", ...cmdOptions.localOptions }
        : { kind: "dev" };
  const {
    deploymentName,
    deploymentUrl: url,
    adminKey,
  } = await ensureDeploymentProvisioned(ctx, {
    teamSlug: project.teamSlug,
    projectSlug: project.projectSlug,
    deploymentOptions,
  });
  return {
    url,
    adminKey,
    deploymentFields: {
      deploymentName,
      deploymentType: deploymentOptions.kind,
      projectSlug: project.projectSlug,
      teamSlug: project.teamSlug,
    },
  };
}

export async function handleManuallySetUrlAndAdminKey(
  ctx: Context,
  cmdOptions: { url: string; adminKey: string },
) {
  const { url, adminKey } = cmdOptions;
  const didErase = await eraseDeploymentEnvVar(ctx);
  if (didErase) {
    logMessage(
      chalk.yellowBright(
        `Removed the CONVEX_DEPLOYMENT environment variable from .env.local`,
      ),
    );
  }
  const envVarWrite = await writeConvexUrlToEnvFile(ctx, url);
  if (envVarWrite !== null) {
    logMessage(
      chalk.green(
        `Saved the given --url as ${envVarWrite.envVar} to ${envVarWrite.envFile}`,
      ),
    );
  }
  return { url, adminKey };
}

export async function selectProject(
  ctx: Context,
  chosenConfiguration: ChosenConfiguration,
  cmdOptions: {
    team?: string | undefined;
    project?: string | undefined;
    devDeployment?: "cloud" | "local" | undefined;
    local?: boolean | undefined;
    cloud?: boolean | undefined;
    defaultProjectName?: string | undefined;
  },
): Promise<{
  teamSlug: string;
  projectSlug: string;
  devDeployment: "cloud" | "local";
}> {
  // Prompt the user to select a project.
  const choice =
    chosenConfiguration !== "ask" && chosenConfiguration !== null
      ? chosenConfiguration
      : await askToConfigure(ctx);
  switch (choice) {
    case "new":
      return selectNewProject(ctx, chosenConfiguration, cmdOptions);
    case "existing":
      return selectExistingProject(ctx, chosenConfiguration, cmdOptions);
    default:
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "No project selected.",
      });
  }
}

const cwd = path.basename(process.cwd());
async function selectNewProject(
  ctx: Context,
  chosenConfiguration: ChosenConfiguration,
  config: {
    team?: string | undefined;
    project?: string | undefined;
    devDeployment?: "cloud" | "local" | undefined;
    cloud?: boolean | undefined;
    local?: boolean | undefined;
    defaultProjectName?: string | undefined;
  },
) {
  const { teamSlug: selectedTeam, chosen: didChooseBetweenTeams } =
    await validateOrSelectTeam(ctx, config.team, "Team:");
  let projectName: string = config.project || cwd;
  let choseProjectInteractively = false;
  if (!config.project) {
    projectName = await promptString(ctx, {
      message: "Project name:",
      default: config.defaultProjectName || cwd,
    });
    choseProjectInteractively = true;
  }

  const { devDeployment } = await selectDevDeploymentType(ctx, {
    chosenConfiguration,
    newOrExisting: "new",
    teamSlug: selectedTeam,
    userHasChosenSomethingInteractively:
      didChooseBetweenTeams || choseProjectInteractively,
    projectSlug: undefined,
    devDeploymentFromFlag: config.devDeployment,
    forceDevDeployment: config.local
      ? "local"
      : config.cloud
        ? "cloud"
        : undefined,
  });

  showSpinner("Creating new Convex project...");

  let projectSlug, teamSlug, projectsRemaining;
  try {
    ({ projectSlug, teamSlug, projectsRemaining } = await createProject(ctx, {
      teamSlug: selectedTeam,
      projectName,
      // We have to create some deployment initially for a project.
      deploymentTypeToProvision: devDeployment === "local" ? "prod" : "dev",
    }));
  } catch (err) {
    logFailure("Unable to create project.");
    return await logAndHandleFetchError(ctx, err);
  }
  const teamMessage = didChooseBetweenTeams
    ? " in team " + chalk.bold(teamSlug)
    : "";
  logFinishedStep(
    `Created project ${chalk.bold(
      projectSlug,
    )}${teamMessage}, manage it at ${chalk.bold(
      projectDashboardUrl(teamSlug, projectSlug),
    )}`,
  );

  if (projectsRemaining <= 2) {
    logWarning(
      chalk.yellow.bold(
        `Your account now has ${projectsRemaining} project${
          projectsRemaining === 1 ? "" : "s"
        } remaining.`,
      ),
    );
  }

  await doCodegenForNewProject(ctx);
  return { teamSlug, projectSlug, devDeployment };
}

async function selectExistingProject(
  ctx: Context,
  chosenConfiguration: ChosenConfiguration,
  config: {
    team?: string | undefined;
    project?: string | undefined;
    devDeployment?: "cloud" | "local" | undefined;
    local?: boolean | undefined;
    cloud?: boolean | undefined;
  },
): Promise<{
  teamSlug: string;
  projectSlug: string;
  devDeployment: "cloud" | "local";
}> {
  const { teamSlug, chosen } = await validateOrSelectTeam(
    ctx,
    config.team,
    "Team:",
  );

  const projectSlug = await validateOrSelectProject(
    ctx,
    config.project,
    teamSlug,
    "Configure project",
    "Project:",
  );
  if (projectSlug === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Run the command again to create a new project instead.",
    });
  }
  const { devDeployment } = await selectDevDeploymentType(ctx, {
    chosenConfiguration,
    newOrExisting: "existing",
    teamSlug,
    projectSlug,
    userHasChosenSomethingInteractively: chosen || !config.project,
    devDeploymentFromFlag: config.devDeployment,
    forceDevDeployment: config.local
      ? "local"
      : config.cloud
        ? "cloud"
        : undefined,
  });

  showSpinner(`Reinitializing project ${projectSlug}...\n`);

  const { projectConfig: existingProjectConfig } = await readProjectConfig(ctx);

  const functionsPath = functionsDir(configName(), existingProjectConfig);

  await doCodegen(ctx, functionsPath, "disable");

  logFinishedStep(`Reinitialized project ${chalk.bold(projectSlug)}`);
  return { teamSlug, projectSlug, devDeployment };
}

async function askToConfigure(ctx: Context): Promise<"new" | "existing"> {
  if (!(await hasProjects(ctx))) {
    return "new";
  }
  return await promptOptions(ctx, {
    message: "What would you like to configure?",
    default: "new",
    choices: [
      { name: "create a new project", value: "new" },
      { name: "choose an existing project", value: "existing" },
    ],
  });
}

type DeploymentOptions =
  | {
      kind: "prod";
    }
  | { kind: "dev" }
  | {
      kind: "local";
      ports?:
        | {
            cloud: number;
            site: number;
          }
        | undefined;
      backendVersion?: string | undefined;
      forceUpgrade: boolean;
    };

/**
 * This method assumes that the member has access to the selected project.
 */
async function ensureDeploymentProvisioned(
  ctx: Context,
  options: {
    teamSlug: string;
    projectSlug: string;
    deploymentOptions: DeploymentOptions;
  },
): Promise<DeploymentDetails> {
  switch (options.deploymentOptions.kind) {
    case "dev":
    case "prod": {
      const credentials =
        await fetchDeploymentCredentialsProvisioningDevOrProdMaybeThrows(
          ctx,
          {
            kind: "teamAndProjectSlugs",
            teamSlug: options.teamSlug,
            projectSlug: options.projectSlug,
          },
          options.deploymentOptions.kind,
        );
      return {
        ...credentials,
        onActivity: null,
      };
    }
    case "local": {
      const credentials = await handleLocalDeployment(ctx, {
        teamSlug: options.teamSlug,
        projectSlug: options.projectSlug,
        ...options.deploymentOptions,
      });
      return credentials;
    }
    default:
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Invalid deployment type: ${(options.deploymentOptions as any).kind}`,
        errForSentry: `Invalid deployment type: ${(options.deploymentOptions as any).kind}`,
      });
  }
}

export async function updateEnvAndConfigForDeploymentSelection(
  ctx: Context,
  options: {
    url: string;
    deploymentName: string;
    teamSlug: string | null;
    projectSlug: string | null;
    deploymentType: DeploymentType;
  },
  existingValue: string | null,
) {
  const { configPath, projectConfig: existingProjectConfig } =
    await readProjectConfig(ctx);

  const functionsPath = functionsDir(configName(), existingProjectConfig);

  const { wroteToGitIgnore, changedDeploymentEnvVar } =
    await writeDeploymentEnvVar(
      ctx,
      options.deploymentType,
      {
        team: options.teamSlug,
        project: options.projectSlug,
        deploymentName: options.deploymentName,
      },
      existingValue,
    );
  const projectConfig = await upgradeOldAuthInfoToAuthConfig(
    ctx,
    existingProjectConfig,
    functionsPath,
  );
  await writeProjectConfig(ctx, projectConfig, {
    deleteIfAllDefault: true,
  });
  await finalizeConfiguration(ctx, {
    deploymentType: options.deploymentType,
    deploymentName: options.deploymentName,
    url: options.url,
    wroteToGitIgnore,
    changedDeploymentEnvVar,
    functionsPath: functionsDir(configPath, projectConfig),
  });
}
