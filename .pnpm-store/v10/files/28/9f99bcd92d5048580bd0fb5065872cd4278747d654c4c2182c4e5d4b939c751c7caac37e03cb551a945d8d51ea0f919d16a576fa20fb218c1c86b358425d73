"use strict";
import chalk from "chalk";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { logFinishedStep, logMessage, showSpinner } from "../bundler/log.js";
import {
  deploymentSelectionWithinProjectFromOptions,
  loadSelectedDeploymentCredentials
} from "./lib/api.js";
import {
  gitBranchFromEnvironment,
  isNonProdBuildEnvironment,
  suggestedEnvVarName
} from "./lib/envvars.js";
import {
  CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
  CONVEX_SELF_HOSTED_URL_VAR_NAME,
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  bigBrainAPI
} from "./lib/utils/utils.js";
import { runFunctionAndLog } from "./lib/run.js";
import { usageStateWarning } from "./lib/usage.js";
import { getTeamAndProjectFromPreviewAdminKey } from "./lib/deployment.js";
import { runPush } from "./lib/components.js";
import { promptYesNo } from "./lib/utils/prompts.js";
import { deployToDeployment, runCommand } from "./lib/deploy2.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
import { deploymentNameAndTypeFromSelection } from "./lib/deploymentSelection.js";
import { checkVersion } from "./lib/updates.js";
export const deploy = new Command("deploy").summary("Deploy to your prod deployment").description(
  `Deploy to your deployment. By default, this deploys to your prod deployment.

Deploys to a preview deployment if the \`${CONVEX_DEPLOY_KEY_ENV_VAR_NAME}\` environment variable is set to a Preview Deploy Key.`
).allowExcessArguments(false).addDeployOptions().addOption(
  new Option(
    "--preview-run <functionName>",
    "Function to run if deploying to a preview deployment. This is ignored if deploying to a production deployment."
  )
).addOption(
  new Option(
    "--preview-create <name>",
    "The name to associate with this deployment if deploying to a newly created preview deployment. Defaults to the current Git branch name in Vercel, Netlify and GitHub CI. This is ignored if deploying to a production deployment."
  ).conflicts("preview-name")
).addOption(
  new Option(
    "--check-build-environment <mode>",
    "Whether to check for a non-production build environment before deploying to a production Convex deployment."
  ).choices(["enable", "disable"]).default("enable").hideHelp()
).addOption(new Option("--admin-key <adminKey>").hideHelp()).addOption(new Option("--url <url>").hideHelp()).addOption(
  new Option(
    "--preview-name <name>",
    "[deprecated] Use `--preview-create` instead. The name to associate with this deployment if deploying to a preview deployment."
  ).hideHelp().conflicts("preview-create")
).addOption(
  new Option(
    "--env-file <envFile>",
    `Path to a custom file of environment variables, for choosing the deployment, e.g. ${CONVEX_DEPLOYMENT_ENV_VAR_NAME} or ${CONVEX_SELF_HOSTED_URL_VAR_NAME}. Same format as .env.local or .env files, and overrides them.`
  )
).addOption(
  new Option("--allow-deleting-large-indexes").hideHelp().conflicts("preview-create").conflicts("preview-name")
).showHelpAfterError().action(async (cmdOptions) => {
  const ctx = await oneoffContext(cmdOptions);
  const deploymentSelection = await getDeploymentSelection(ctx, cmdOptions);
  if (cmdOptions.checkBuildEnvironment === "enable" && isNonProdBuildEnvironment() && deploymentSelection.kind === "existingDeployment" && deploymentSelection.deploymentToActOn.source === "deployKey" && deploymentSelection.deploymentToActOn.deploymentFields?.deploymentType === "prod") {
    await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Detected a non-production build environment and "${CONVEX_DEPLOY_KEY_ENV_VAR_NAME}" for a production Convex deployment.

          This is probably unintentional.
          `
    });
  }
  if (deploymentSelection.kind === "anonymous") {
    logMessage(
      "You are currently developing anonymously with a locally running project.\nTo deploy your Convex app to the cloud, log in by running `npx convex login`.\nSee https://docs.convex.dev/production for more information on how Convex cloud works and instructions on how to set up hosting."
    );
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: null
    });
  }
  if (deploymentSelection.kind === "preview") {
    if (cmdOptions.previewName !== void 0) {
      await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "The `--preview-name` flag has been deprecated in favor of `--preview-create`. Please re-run the command using `--preview-create` instead."
      });
    }
    const teamAndProjectSlugs = await getTeamAndProjectFromPreviewAdminKey(
      ctx,
      deploymentSelection.previewDeployKey
    );
    await deployToNewPreviewDeployment(
      ctx,
      {
        previewDeployKey: deploymentSelection.previewDeployKey,
        projectSelection: {
          kind: "teamAndProjectSlugs",
          teamSlug: teamAndProjectSlugs.teamSlug,
          projectSlug: teamAndProjectSlugs.projectSlug
        }
      },
      {
        ...cmdOptions
      }
    );
  } else {
    await deployToExistingDeployment(ctx, {
      ...cmdOptions,
      allowDeletingLargeIndexes: cmdOptions.allowDeletingLargeIndexes ?? false
    });
  }
});
async function deployToNewPreviewDeployment(ctx, deploymentSelection, options) {
  const previewName = options.previewCreate ?? gitBranchFromEnvironment();
  if (previewName === null) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`npx convex deploy` to a preview deployment could not determine the preview name. Provide one using `--preview-create`"
    });
  }
  if (options.dryRun) {
    logFinishedStep(
      `Would have claimed preview deployment for "${previewName}"`
    );
    await runCommand(ctx, {
      cmdUrlEnvVarName: options.cmdUrlEnvVarName,
      cmd: options.cmd,
      dryRun: !!options.dryRun,
      url: "https://<PREVIEW DEPLOYMENT>.convex.cloud",
      adminKey: "preview-deployment-admin-key"
    });
    logFinishedStep(
      `Would have deployed Convex functions to preview deployment for "${previewName}"`
    );
    if (options.previewRun !== void 0) {
      logMessage(`Would have run function "${options.previewRun}"`);
    }
    return;
  }
  const data = await bigBrainAPI({
    ctx,
    method: "POST",
    url: "claim_preview_deployment",
    data: {
      projectSelection: deploymentSelection.projectSelection,
      identifier: previewName
    }
  });
  const previewAdminKey = data.adminKey;
  const previewUrl = data.instanceUrl;
  await runCommand(ctx, {
    ...options,
    url: previewUrl,
    adminKey: previewAdminKey
  });
  const pushOptions = {
    deploymentName: data.deploymentName,
    adminKey: previewAdminKey,
    verbose: !!options.verbose,
    dryRun: false,
    typecheck: options.typecheck,
    typecheckComponents: options.typecheckComponents,
    debug: !!options.debug,
    debugBundlePath: options.debugBundlePath,
    debugNodeApis: false,
    codegen: options.codegen === "enable",
    url: previewUrl,
    liveComponentSources: false,
    largeIndexDeletionCheck: "no verification"
    // fine for preview deployments
  };
  showSpinner(`Deploying to ${previewUrl}...`);
  await runPush(ctx, pushOptions);
  logFinishedStep(`Deployed Convex functions to ${previewUrl}`);
  if (options.previewRun !== void 0) {
    await runFunctionAndLog(ctx, {
      deploymentUrl: previewUrl,
      adminKey: previewAdminKey,
      functionName: options.previewRun,
      argsString: "{}",
      componentPath: void 0,
      callbacks: {
        onSuccess: () => {
          logFinishedStep(`Finished running function "${options.previewRun}"`);
        }
      }
    });
  }
}
async function deployToExistingDeployment(ctx, options) {
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions({
    ...options,
    implicitProd: true
  });
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const deploymentToActOn = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const { deploymentFields } = deploymentToActOn;
  const configuredDeployment = deploymentNameAndTypeFromSelection(deploymentSelection);
  if (configuredDeployment !== null && configuredDeployment.name !== null) {
    const shouldPushToProd = configuredDeployment.name === deploymentFields?.deploymentName || (options.yes ?? await askToConfirmPush(
      ctx,
      {
        configuredName: configuredDeployment.name,
        configuredType: configuredDeployment.type,
        requestedName: deploymentFields?.deploymentName,
        requestedType: deploymentFields?.deploymentType
      },
      deploymentToActOn.url
    ));
    if (!shouldPushToProd) {
      await ctx.crash({
        exitCode: 1,
        printedMessage: null,
        errorType: "fatal"
      });
    }
  }
  const isCloudDeployment = deploymentFields !== null;
  await Promise.all([
    deployToDeployment(
      ctx,
      {
        url: deploymentToActOn.url,
        adminKey: deploymentToActOn.adminKey,
        deploymentName: deploymentFields?.deploymentName ?? null
      },
      options
    ),
    ...isCloudDeployment ? [
      usageStateWarning(ctx, deploymentFields.deploymentName),
      checkVersion()
    ] : []
  ]);
}
async function askToConfirmPush(ctx, deployment, prodUrl) {
  logMessage(
    `You're currently developing against your ${chalk.bold(
      deployment.configuredType ?? "dev"
    )} deployment

  ${deployment.configuredName} (set in CONVEX_DEPLOYMENT)

Your ${chalk.bold(deployment.requestedType)} deployment ${chalk.bold(
      deployment.requestedName
    )} serves traffic at:

  ${(await suggestedEnvVarName(ctx)).envVar}=${chalk.bold(prodUrl)}

Make sure that your published client is configured with this URL (for instructions see https://docs.convex.dev/hosting)
`
  );
  return promptYesNo(ctx, {
    message: `Do you want to push your code to your ${deployment.requestedType} deployment ${deployment.requestedName} now?`,
    default: true
  });
}
//# sourceMappingURL=deploy.js.map
