"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var deploy_exports = {};
__export(deploy_exports, {
  deploy: () => deploy
});
module.exports = __toCommonJS(deploy_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_api = require("./lib/api.js");
var import_envvars = require("./lib/envvars.js");
var import_utils = require("./lib/utils/utils.js");
var import_run = require("./lib/run.js");
var import_usage = require("./lib/usage.js");
var import_deployment = require("./lib/deployment.js");
var import_components2 = require("./lib/components.js");
var import_prompts = require("./lib/utils/prompts.js");
var import_deploy2 = require("./lib/deploy2.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_deploymentSelection2 = require("./lib/deploymentSelection.js");
var import_updates = require("./lib/updates.js");
const deploy = new import_extra_typings.Command("deploy").summary("Deploy to your prod deployment").description(
  `Deploy to your deployment. By default, this deploys to your prod deployment.

Deploys to a preview deployment if the \`${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME}\` environment variable is set to a Preview Deploy Key.`
).allowExcessArguments(false).addDeployOptions().addOption(
  new import_extra_typings.Option(
    "--preview-run <functionName>",
    "Function to run if deploying to a preview deployment. This is ignored if deploying to a production deployment."
  )
).addOption(
  new import_extra_typings.Option(
    "--preview-create <name>",
    "The name to associate with this deployment if deploying to a newly created preview deployment. Defaults to the current Git branch name in Vercel, Netlify and GitHub CI. This is ignored if deploying to a production deployment."
  ).conflicts("preview-name")
).addOption(
  new import_extra_typings.Option(
    "--check-build-environment <mode>",
    "Whether to check for a non-production build environment before deploying to a production Convex deployment."
  ).choices(["enable", "disable"]).default("enable").hideHelp()
).addOption(new import_extra_typings.Option("--admin-key <adminKey>").hideHelp()).addOption(new import_extra_typings.Option("--url <url>").hideHelp()).addOption(
  new import_extra_typings.Option(
    "--preview-name <name>",
    "[deprecated] Use `--preview-create` instead. The name to associate with this deployment if deploying to a preview deployment."
  ).hideHelp().conflicts("preview-create")
).addOption(
  new import_extra_typings.Option(
    "--env-file <envFile>",
    `Path to a custom file of environment variables, for choosing the deployment, e.g. ${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} or ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}. Same format as .env.local or .env files, and overrides them.`
  )
).addOption(
  new import_extra_typings.Option("--allow-deleting-large-indexes").hideHelp().conflicts("preview-create").conflicts("preview-name")
).showHelpAfterError().action(async (cmdOptions) => {
  const ctx = await (0, import_context.oneoffContext)(cmdOptions);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, cmdOptions);
  if (cmdOptions.checkBuildEnvironment === "enable" && (0, import_envvars.isNonProdBuildEnvironment)() && deploymentSelection.kind === "existingDeployment" && deploymentSelection.deploymentToActOn.source === "deployKey" && deploymentSelection.deploymentToActOn.deploymentFields?.deploymentType === "prod") {
    await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Detected a non-production build environment and "${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME}" for a production Convex deployment.

          This is probably unintentional.
          `
    });
  }
  if (deploymentSelection.kind === "anonymous") {
    (0, import_log.logMessage)(
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
    const teamAndProjectSlugs = await (0, import_deployment.getTeamAndProjectFromPreviewAdminKey)(
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
  const previewName = options.previewCreate ?? (0, import_envvars.gitBranchFromEnvironment)();
  if (previewName === null) {
    await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`npx convex deploy` to a preview deployment could not determine the preview name. Provide one using `--preview-create`"
    });
  }
  if (options.dryRun) {
    (0, import_log.logFinishedStep)(
      `Would have claimed preview deployment for "${previewName}"`
    );
    await (0, import_deploy2.runCommand)(ctx, {
      cmdUrlEnvVarName: options.cmdUrlEnvVarName,
      cmd: options.cmd,
      dryRun: !!options.dryRun,
      url: "https://<PREVIEW DEPLOYMENT>.convex.cloud",
      adminKey: "preview-deployment-admin-key"
    });
    (0, import_log.logFinishedStep)(
      `Would have deployed Convex functions to preview deployment for "${previewName}"`
    );
    if (options.previewRun !== void 0) {
      (0, import_log.logMessage)(`Would have run function "${options.previewRun}"`);
    }
    return;
  }
  const data = await (0, import_utils.bigBrainAPI)({
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
  await (0, import_deploy2.runCommand)(ctx, {
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
  (0, import_log.showSpinner)(`Deploying to ${previewUrl}...`);
  await (0, import_components2.runPush)(ctx, pushOptions);
  (0, import_log.logFinishedStep)(`Deployed Convex functions to ${previewUrl}`);
  if (options.previewRun !== void 0) {
    await (0, import_run.runFunctionAndLog)(ctx, {
      deploymentUrl: previewUrl,
      adminKey: previewAdminKey,
      functionName: options.previewRun,
      argsString: "{}",
      componentPath: void 0,
      callbacks: {
        onSuccess: () => {
          (0, import_log.logFinishedStep)(`Finished running function "${options.previewRun}"`);
        }
      }
    });
  }
}
async function deployToExistingDeployment(ctx, options) {
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)({
    ...options,
    implicitProd: true
  });
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deploymentToActOn = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const { deploymentFields } = deploymentToActOn;
  const configuredDeployment = (0, import_deploymentSelection2.deploymentNameAndTypeFromSelection)(deploymentSelection);
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
    (0, import_deploy2.deployToDeployment)(
      ctx,
      {
        url: deploymentToActOn.url,
        adminKey: deploymentToActOn.adminKey,
        deploymentName: deploymentFields?.deploymentName ?? null
      },
      options
    ),
    ...isCloudDeployment ? [
      (0, import_usage.usageStateWarning)(ctx, deploymentFields.deploymentName),
      (0, import_updates.checkVersion)()
    ] : []
  ]);
}
async function askToConfirmPush(ctx, deployment, prodUrl) {
  (0, import_log.logMessage)(
    `You're currently developing against your ${import_chalk.default.bold(
      deployment.configuredType ?? "dev"
    )} deployment

  ${deployment.configuredName} (set in CONVEX_DEPLOYMENT)

Your ${import_chalk.default.bold(deployment.requestedType)} deployment ${import_chalk.default.bold(
      deployment.requestedName
    )} serves traffic at:

  ${(await (0, import_envvars.suggestedEnvVarName)(ctx)).envVar}=${import_chalk.default.bold(prodUrl)}

Make sure that your published client is configured with this URL (for instructions see https://docs.convex.dev/hosting)
`
  );
  return (0, import_prompts.promptYesNo)(ctx, {
    message: `Do you want to push your code to your ${deployment.requestedType} deployment ${deployment.requestedName} now?`,
    default: true
  });
}
//# sourceMappingURL=deploy.js.map
