import { Command, Option } from "@commander-js/extra-typings";
import { Context, oneoffContext } from "../bundler/context.js";
import { logFailure, logFinishedStep, logMessage } from "../bundler/log.js";
import { checkAuthorization, performLogin } from "./lib/login.js";
import { loadUuidForAnonymousUser } from "./lib/localDeployment/filePaths.js";
import {
  handleLinkToProject,
  listExistingAnonymousDeployments,
} from "./lib/localDeployment/anonymous.js";
import {
  DASHBOARD_HOST,
  deploymentDashboardUrlPage,
  teamDashboardUrl,
} from "./lib/dashboard.js";
import { promptSearch, promptYesNo } from "./lib/utils/prompts.js";
import { bigBrainAPI, validateOrSelectTeam } from "./lib/utils/utils.js";
import {
  selectProject,
  updateEnvAndConfigForDeploymentSelection,
} from "./configure.js";
import {
  getDeploymentSelection,
  shouldAllowAnonymousDevelopment,
} from "./lib/deploymentSelection.js";
import { removeAnonymousPrefix } from "./lib/deployment.js";
import {
  readGlobalConfig,
  globalConfigPath,
} from "./lib/utils/globalConfig.js";
import { getTeamsForUser } from "./lib/api.js";

const loginStatus = new Command("status")
  .description("Check login status and list accessible teams")
  .allowExcessArguments(false)
  .action(async () => {
    const ctx = await oneoffContext({
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });

    const globalConfig = readGlobalConfig(ctx);
    const hasToken = globalConfig?.accessToken !== null;

    if (hasToken) {
      logMessage(`Convex account token found in: ${globalConfigPath()}`);
    } else {
      logMessage("No token found locally");
      return;
    }

    const isLoggedIn = await checkAuthorization(ctx, false);

    if (!isLoggedIn) {
      logMessage("Status: Not logged in");
      return;
    }

    logMessage("Status: Logged in");
    const teams = await getTeamsForUser(ctx);
    logMessage(
      `Teams: ${teams.length} team${teams.length === 1 ? "" : "s"} accessible`,
    );
    for (const team of teams) {
      logMessage(`  - ${team.name} (${team.slug})`);
    }
  });

export const login = new Command("login")
  .description("Login to Convex")
  .allowExcessArguments(false)
  .option(
    "--device-name <name>",
    "Provide a name for the device being authorized",
  )
  .option(
    "-f, --force",
    "Proceed with login even if a valid access token already exists for this device",
  )
  .option(
    "--no-open",
    "Don't automatically open the login link in the default browser",
  )
  .addOption(
    new Option(
      "--login-flow <mode>",
      `How to log in; defaults to guessing based on the environment.`,
    )
      .choices(["paste", "auto", "poll"] as const)
      .default("auto" as const),
  )
  .addOption(new Option("--link-deployments").hideHelp())
  // These options are hidden from the help/usage message, but allow overriding settings for testing.
  // Change the auth credentials with the auth provider
  .addOption(new Option("--override-auth-url <url>").hideHelp())
  .addOption(new Option("--override-auth-client <id>").hideHelp())
  .addOption(new Option("--override-auth-username <username>").hideHelp())
  .addOption(new Option("--override-auth-password <password>").hideHelp())
  // Skip the auth provider login and directly use this access token
  .addOption(new Option("--override-access-token <token>").hideHelp())
  // Automatically accept opt ins without prompting
  .addOption(new Option("--accept-opt-ins").hideHelp())
  // Dump the access token from the auth provider and skip authorization with Convex
  .addOption(new Option("--dump-access-token").hideHelp())
  // Hidden option for tests to check if the user is logged in.
  .addOption(new Option("--check-login").hideHelp())
  // Redirect to Vercel SSO integration URL
  .addOption(
    new Option(
      "--vercel",
      "Redirect to Vercel SSO integration for login",
    ).hideHelp(),
  )
  // Override the Vercel URL slug (defaults to 'convex')
  .addOption(new Option("--vercel-override <slug>").hideHelp())
  .addCommand(loginStatus)
  .addHelpCommand(false)
  .action(async (options, cmd: Command) => {
    const ctx = await oneoffContext({
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });
    if (
      !options.force &&
      (await checkAuthorization(ctx, !!options.acceptOptIns))
    ) {
      logFinishedStep(
        "This device has previously been authorized and is ready for use with Convex.",
      );
      await handleLinkingDeployments(ctx, {
        interactive: !!options.linkDeployments,
      });
      return;
    }
    if (!options.force && options.checkLogin) {
      const isLoggedIn = await checkAuthorization(ctx, !!options.acceptOptIns);
      if (!isLoggedIn) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          errForSentry: "You are not logged in.",
          printedMessage: "You are not logged in.",
        });
      }
    }
    if (!!options.overrideAuthUsername !== !!options.overrideAuthPassword) {
      cmd.error(
        "If overriding credentials, both username and password must be provided",
      );
    }

    const uuid = loadUuidForAnonymousUser(ctx);
    await performLogin(ctx, {
      ...options,
      anonymousId: uuid,
      vercel: options.vercel,
      vercelOverride: options.vercelOverride,
    });

    await handleLinkingDeployments(ctx, {
      interactive: !!options.linkDeployments,
    });
  });

async function handleLinkingDeployments(
  ctx: Context,
  args: {
    interactive: boolean;
  },
) {
  if (!shouldAllowAnonymousDevelopment()) {
    return;
  }
  const anonymousDeployments = await listExistingAnonymousDeployments(ctx);
  if (anonymousDeployments.length === 0) {
    if (args.interactive) {
      logMessage(
        "It doesn't look like you have any deployments to link. You can run `npx convex dev` to set up a new project or select an existing one.",
      );
    }
    return;
  }

  if (!args.interactive) {
    const message = getMessage(
      anonymousDeployments.map((d) => d.deploymentName),
    );
    const createProjects = await promptYesNo(ctx, {
      message,
      default: true,
    });
    if (!createProjects) {
      logMessage(
        "Not linking your existing deployments. If you want to link them later, run `npx convex login --link-deployments`.",
      );
      logMessage(
        `Visit ${DASHBOARD_HOST} or run \`npx convex dev\` to get started with your new account.`,
      );
      return;
    }

    const { teamSlug } = await validateOrSelectTeam(
      ctx,
      undefined,
      "Choose a team for your deployments:",
    );
    const projectsRemaining = await getProjectsRemaining(ctx, teamSlug);
    if (anonymousDeployments.length > projectsRemaining) {
      logFailure(
        `You have ${anonymousDeployments.length} deployments to link, but only have ${projectsRemaining} projects remaining. If you'd like to choose which ones to link, run this command with the --link-deployments flag.`,
      );
      return;
    }

    const deploymentSelection = await getDeploymentSelection(ctx, {
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });
    const configuredDeployment =
      deploymentSelection.kind === "anonymous"
        ? deploymentSelection.deploymentName
        : null;

    let dashboardUrl = teamDashboardUrl(teamSlug);

    for (const deployment of anonymousDeployments) {
      const linkedDeployment = await handleLinkToProject(ctx, {
        deploymentName: deployment.deploymentName,
        teamSlug,
        projectSlug: null,
      });
      logFinishedStep(
        `Added ${deployment.deploymentName} to project ${linkedDeployment.projectSlug}`,
      );
      if (deployment.deploymentName === configuredDeployment) {
        // If the current project has a `CONVEX_DEPLOYMENT` env var configured, replace
        // it with the new value.
        await updateEnvAndConfigForDeploymentSelection(
          ctx,
          {
            url: linkedDeployment.deploymentUrl,
            deploymentName: linkedDeployment.deploymentName,
            teamSlug,
            projectSlug: linkedDeployment.projectSlug,
            deploymentType: "local",
          },
          configuredDeployment,
        );
        dashboardUrl = deploymentDashboardUrlPage(
          linkedDeployment.deploymentName,
          "",
        );
      }
    }
    logFinishedStep(
      `Sucessfully linked your deployments! Visit ${dashboardUrl} to get started.`,
    );
    return;
  }

  const deploymentSelection = await getDeploymentSelection(ctx, {
    url: undefined,
    adminKey: undefined,
    envFile: undefined,
  });
  const configuredDeployment =
    deploymentSelection.kind === "anonymous"
      ? deploymentSelection.deploymentName
      : null;
  while (true) {
    logMessage(
      getDeploymentListMessage(
        anonymousDeployments.map((d) => d.deploymentName),
      ),
    );
    const updatedAnonymousDeployments =
      await listExistingAnonymousDeployments(ctx);
    const deploymentToLink = await promptSearch(ctx, {
      message: "Which deployment would you like to link to your account?",
      choices: updatedAnonymousDeployments.map((d) => ({
        name: d.deploymentName,
        value: d.deploymentName,
      })),
    });
    const { teamSlug } = await validateOrSelectTeam(
      ctx,
      undefined,
      "Choose a team for your deployment:",
    );
    const { projectSlug } = await selectProject(ctx, "ask", {
      team: teamSlug,
      devDeployment: "local",
      defaultProjectName: removeAnonymousPrefix(deploymentToLink),
    });
    const linkedDeployment = await handleLinkToProject(ctx, {
      deploymentName: deploymentToLink,
      teamSlug,
      projectSlug,
    });
    logFinishedStep(
      `Added ${deploymentToLink} to project ${linkedDeployment.projectSlug}`,
    );
    if (deploymentToLink === configuredDeployment) {
      await updateEnvAndConfigForDeploymentSelection(
        ctx,
        {
          url: linkedDeployment.deploymentUrl,
          deploymentName: linkedDeployment.deploymentName,
          teamSlug,
          projectSlug: linkedDeployment.projectSlug,
          deploymentType: "local",
        },
        configuredDeployment,
      );
    }
    const shouldContinue = await promptYesNo(ctx, {
      message: "Would you like to link another deployment?",
      default: true,
    });
    if (!shouldContinue) {
      break;
    }
  }
}

async function getProjectsRemaining(ctx: Context, teamSlug: string) {
  const response = await bigBrainAPI<{ projectsRemaining: number }>({
    ctx,
    method: "GET",
    url: `teams/${teamSlug}/projects_remaining`,
  });

  return response.projectsRemaining;
}

function getDeploymentListMessage(anonymousDeploymentNames: string[]) {
  let message = `You have ${anonymousDeploymentNames.length} existing deployments.`;
  message += `\n\nDeployments:`;
  for (const deploymentName of anonymousDeploymentNames) {
    message += `\n- ${deploymentName}`;
  }
  return message;
}

function getMessage(anonymousDeploymentNames: string[]) {
  if (anonymousDeploymentNames.length === 1) {
    return `Would you like to link your existing deployment to your account? ("${anonymousDeploymentNames[0]}")`;
  }
  let message = `You have ${anonymousDeploymentNames.length} existing deployments. Would you like to link them to your account?`;
  message += `\n\nDeployments:`;
  for (const deploymentName of anonymousDeploymentNames) {
    message += `\n- ${deploymentName}`;
  }
  message += `\n\nYou can alternatively run \`npx convex login --link-deployments\` to interactively choose which deployments to add.`;
  return message;
}
