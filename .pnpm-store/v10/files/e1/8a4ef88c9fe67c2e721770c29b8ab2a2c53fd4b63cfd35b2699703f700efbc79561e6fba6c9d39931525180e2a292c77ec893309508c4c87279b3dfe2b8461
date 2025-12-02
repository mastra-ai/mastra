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
var login_exports = {};
__export(login_exports, {
  login: () => login
});
module.exports = __toCommonJS(login_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_login = require("./lib/login.js");
var import_filePaths = require("./lib/localDeployment/filePaths.js");
var import_anonymous = require("./lib/localDeployment/anonymous.js");
var import_dashboard = require("./lib/dashboard.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_utils = require("./lib/utils/utils.js");
var import_configure = require("./configure.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_deployment = require("./lib/deployment.js");
var import_globalConfig = require("./lib/utils/globalConfig.js");
var import_api = require("./lib/api.js");
const loginStatus = new import_extra_typings.Command("status").description("Check login status and list accessible teams").allowExcessArguments(false).action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const globalConfig = (0, import_globalConfig.readGlobalConfig)(ctx);
  const hasToken = globalConfig?.accessToken !== null;
  if (hasToken) {
    (0, import_log.logMessage)(`Convex account token found in: ${(0, import_globalConfig.globalConfigPath)()}`);
  } else {
    (0, import_log.logMessage)("No token found locally");
    return;
  }
  const isLoggedIn = await (0, import_login.checkAuthorization)(ctx, false);
  if (!isLoggedIn) {
    (0, import_log.logMessage)("Status: Not logged in");
    return;
  }
  (0, import_log.logMessage)("Status: Logged in");
  const teams = await (0, import_api.getTeamsForUser)(ctx);
  (0, import_log.logMessage)(
    `Teams: ${teams.length} team${teams.length === 1 ? "" : "s"} accessible`
  );
  for (const team of teams) {
    (0, import_log.logMessage)(`  - ${team.name} (${team.slug})`);
  }
});
const login = new import_extra_typings.Command("login").description("Login to Convex").allowExcessArguments(false).option(
  "--device-name <name>",
  "Provide a name for the device being authorized"
).option(
  "-f, --force",
  "Proceed with login even if a valid access token already exists for this device"
).option(
  "--no-open",
  "Don't automatically open the login link in the default browser"
).addOption(
  new import_extra_typings.Option(
    "--login-flow <mode>",
    `How to log in; defaults to guessing based on the environment.`
  ).choices(["paste", "auto", "poll"]).default("auto")
).addOption(new import_extra_typings.Option("--link-deployments").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-url <url>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-client <id>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-username <username>").hideHelp()).addOption(new import_extra_typings.Option("--override-auth-password <password>").hideHelp()).addOption(new import_extra_typings.Option("--override-access-token <token>").hideHelp()).addOption(new import_extra_typings.Option("--accept-opt-ins").hideHelp()).addOption(new import_extra_typings.Option("--dump-access-token").hideHelp()).addOption(new import_extra_typings.Option("--check-login").hideHelp()).addOption(
  new import_extra_typings.Option(
    "--vercel",
    "Redirect to Vercel SSO integration for login"
  ).hideHelp()
).addOption(new import_extra_typings.Option("--vercel-override <slug>").hideHelp()).addCommand(loginStatus).addHelpCommand(false).action(async (options, cmd) => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  if (!options.force && await (0, import_login.checkAuthorization)(ctx, !!options.acceptOptIns)) {
    (0, import_log.logFinishedStep)(
      "This device has previously been authorized and is ready for use with Convex."
    );
    await handleLinkingDeployments(ctx, {
      interactive: !!options.linkDeployments
    });
    return;
  }
  if (!options.force && options.checkLogin) {
    const isLoggedIn = await (0, import_login.checkAuthorization)(ctx, !!options.acceptOptIns);
    if (!isLoggedIn) {
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: "You are not logged in.",
        printedMessage: "You are not logged in."
      });
    }
  }
  if (!!options.overrideAuthUsername !== !!options.overrideAuthPassword) {
    cmd.error(
      "If overriding credentials, both username and password must be provided"
    );
  }
  const uuid = (0, import_filePaths.loadUuidForAnonymousUser)(ctx);
  await (0, import_login.performLogin)(ctx, {
    ...options,
    anonymousId: uuid,
    vercel: options.vercel,
    vercelOverride: options.vercelOverride
  });
  await handleLinkingDeployments(ctx, {
    interactive: !!options.linkDeployments
  });
});
async function handleLinkingDeployments(ctx, args) {
  if (!(0, import_deploymentSelection.shouldAllowAnonymousDevelopment)()) {
    return;
  }
  const anonymousDeployments = await (0, import_anonymous.listExistingAnonymousDeployments)(ctx);
  if (anonymousDeployments.length === 0) {
    if (args.interactive) {
      (0, import_log.logMessage)(
        "It doesn't look like you have any deployments to link. You can run `npx convex dev` to set up a new project or select an existing one."
      );
    }
    return;
  }
  if (!args.interactive) {
    const message = getMessage(
      anonymousDeployments.map((d) => d.deploymentName)
    );
    const createProjects = await (0, import_prompts.promptYesNo)(ctx, {
      message,
      default: true
    });
    if (!createProjects) {
      (0, import_log.logMessage)(
        "Not linking your existing deployments. If you want to link them later, run `npx convex login --link-deployments`."
      );
      (0, import_log.logMessage)(
        `Visit ${import_dashboard.DASHBOARD_HOST} or run \`npx convex dev\` to get started with your new account.`
      );
      return;
    }
    const { teamSlug } = await (0, import_utils.validateOrSelectTeam)(
      ctx,
      void 0,
      "Choose a team for your deployments:"
    );
    const projectsRemaining = await getProjectsRemaining(ctx, teamSlug);
    if (anonymousDeployments.length > projectsRemaining) {
      (0, import_log.logFailure)(
        `You have ${anonymousDeployments.length} deployments to link, but only have ${projectsRemaining} projects remaining. If you'd like to choose which ones to link, run this command with the --link-deployments flag.`
      );
      return;
    }
    const deploymentSelection2 = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
      url: void 0,
      adminKey: void 0,
      envFile: void 0
    });
    const configuredDeployment2 = deploymentSelection2.kind === "anonymous" ? deploymentSelection2.deploymentName : null;
    let dashboardUrl = (0, import_dashboard.teamDashboardUrl)(teamSlug);
    for (const deployment of anonymousDeployments) {
      const linkedDeployment = await (0, import_anonymous.handleLinkToProject)(ctx, {
        deploymentName: deployment.deploymentName,
        teamSlug,
        projectSlug: null
      });
      (0, import_log.logFinishedStep)(
        `Added ${deployment.deploymentName} to project ${linkedDeployment.projectSlug}`
      );
      if (deployment.deploymentName === configuredDeployment2) {
        await (0, import_configure.updateEnvAndConfigForDeploymentSelection)(
          ctx,
          {
            url: linkedDeployment.deploymentUrl,
            deploymentName: linkedDeployment.deploymentName,
            teamSlug,
            projectSlug: linkedDeployment.projectSlug,
            deploymentType: "local"
          },
          configuredDeployment2
        );
        dashboardUrl = (0, import_dashboard.deploymentDashboardUrlPage)(
          linkedDeployment.deploymentName,
          ""
        );
      }
    }
    (0, import_log.logFinishedStep)(
      `Sucessfully linked your deployments! Visit ${dashboardUrl} to get started.`
    );
    return;
  }
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const configuredDeployment = deploymentSelection.kind === "anonymous" ? deploymentSelection.deploymentName : null;
  while (true) {
    (0, import_log.logMessage)(
      getDeploymentListMessage(
        anonymousDeployments.map((d) => d.deploymentName)
      )
    );
    const updatedAnonymousDeployments = await (0, import_anonymous.listExistingAnonymousDeployments)(ctx);
    const deploymentToLink = await (0, import_prompts.promptSearch)(ctx, {
      message: "Which deployment would you like to link to your account?",
      choices: updatedAnonymousDeployments.map((d) => ({
        name: d.deploymentName,
        value: d.deploymentName
      }))
    });
    const { teamSlug } = await (0, import_utils.validateOrSelectTeam)(
      ctx,
      void 0,
      "Choose a team for your deployment:"
    );
    const { projectSlug } = await (0, import_configure.selectProject)(ctx, "ask", {
      team: teamSlug,
      devDeployment: "local",
      defaultProjectName: (0, import_deployment.removeAnonymousPrefix)(deploymentToLink)
    });
    const linkedDeployment = await (0, import_anonymous.handleLinkToProject)(ctx, {
      deploymentName: deploymentToLink,
      teamSlug,
      projectSlug
    });
    (0, import_log.logFinishedStep)(
      `Added ${deploymentToLink} to project ${linkedDeployment.projectSlug}`
    );
    if (deploymentToLink === configuredDeployment) {
      await (0, import_configure.updateEnvAndConfigForDeploymentSelection)(
        ctx,
        {
          url: linkedDeployment.deploymentUrl,
          deploymentName: linkedDeployment.deploymentName,
          teamSlug,
          projectSlug: linkedDeployment.projectSlug,
          deploymentType: "local"
        },
        configuredDeployment
      );
    }
    const shouldContinue = await (0, import_prompts.promptYesNo)(ctx, {
      message: "Would you like to link another deployment?",
      default: true
    });
    if (!shouldContinue) {
      break;
    }
  }
}
async function getProjectsRemaining(ctx, teamSlug) {
  const response = await (0, import_utils.bigBrainAPI)({
    ctx,
    method: "GET",
    url: `teams/${teamSlug}/projects_remaining`
  });
  return response.projectsRemaining;
}
function getDeploymentListMessage(anonymousDeploymentNames) {
  let message = `You have ${anonymousDeploymentNames.length} existing deployments.`;
  message += `

Deployments:`;
  for (const deploymentName of anonymousDeploymentNames) {
    message += `
- ${deploymentName}`;
  }
  return message;
}
function getMessage(anonymousDeploymentNames) {
  if (anonymousDeploymentNames.length === 1) {
    return `Would you like to link your existing deployment to your account? ("${anonymousDeploymentNames[0]}")`;
  }
  let message = `You have ${anonymousDeploymentNames.length} existing deployments. Would you like to link them to your account?`;
  message += `

Deployments:`;
  for (const deploymentName of anonymousDeploymentNames) {
    message += `
- ${deploymentName}`;
  }
  message += `

You can alternatively run \`npx convex login --link-deployments\` to interactively choose which deployments to add.`;
  return message;
}
//# sourceMappingURL=login.js.map
