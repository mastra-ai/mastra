"use strict";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { logVerbose } from "../bundler/log.js";
import { deploymentCredentialsOrConfigure } from "./configure.js";
import { usageStateWarning } from "./lib/usage.js";
import { normalizeDevOptions } from "./lib/command.js";
import { devAgainstDeployment } from "./lib/dev.js";
import { deploymentSelectionWithinProjectFromOptions } from "./lib/api.js";
import {
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  CONVEX_SELF_HOSTED_URL_VAR_NAME
} from "./lib/utils/utils.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
import { detectSuspiciousEnvironmentVariables } from "./lib/envvars.js";
import { checkVersion } from "./lib/updates.js";
export const dev = new Command("dev").summary("Develop against a dev deployment, watching for changes").description(
  "Develop against a dev deployment, watching for changes\n\n  1. Configures a new or existing project (if needed)\n  2. Updates generated types and pushes code to the configured dev deployment\n  3. Runs the provided command (if `--run` or `--run-sh` is used)\n  4. Watches for file changes, and repeats step 2\n"
).allowExcessArguments(false).option("-v, --verbose", "Show full listing of changes").addOption(
  new Option(
    "--typecheck <mode>",
    `Check TypeScript files with \`tsc --noEmit\`.`
  ).choices(["enable", "try", "disable"]).default("try")
).option(
  "--typecheck-components",
  "Check TypeScript files within component implementations with `tsc --noEmit`.",
  false
).addOption(
  new Option("--codegen <mode>", "Regenerate code in `convex/_generated/`").choices(["enable", "disable"]).default("enable")
).option(
  "--once",
  "Execute only the first 3 steps, stop on any failure",
  false
).option(
  "--until-success",
  "Execute only the first 3 steps, on failure watch for local and remote changes and retry steps 2 and 3",
  false
).addOption(
  new Option(
    "--run <functionName>",
    "The identifier of the function to run in step 3, like `api.init.createData` or `myDir/myFile:myFunction`"
  ).conflicts(["--run-sh"])
).option(
  "--run-component <functionName>",
  "If --run is used and the function is in a component, the path the component tree defined in convex.config.ts. Components are a beta feature. This flag is unstable and may change in subsequent releases."
).addOption(
  new Option(
    "--run-sh <command>",
    "A shell command to run in step 3, like `node myScript.js`. If you just want to run a Convex function, use `--run` instead."
  ).conflicts(["--run"])
).addOption(
  new Option(
    "--tail-logs [mode]",
    "Choose whether to tail Convex function logs in this terminal"
  ).choices(["always", "pause-on-deploy", "disable"]).default("pause-on-deploy")
).addOption(new Option("--trace-events").default(false).hideHelp()).addOption(new Option("--debug-bundle-path <path>").hideHelp()).addOption(new Option("--debug-node-apis").hideHelp()).addOption(new Option("--live-component-sources").hideHelp()).addOption(
  new Option(
    "--configure [choice]",
    "Ignore existing configuration and configure new or existing project, interactively or set by --team <team_slug>, --project <project_slug>, and --dev-deployment local|cloud"
  ).choices(["new", "existing"]).conflicts(["--local", "--cloud"])
).addOption(
  new Option(
    "--team <team_slug>",
    "The team you'd like to use for this project"
  ).hideHelp()
).addOption(
  new Option(
    "--project <project_slug>",
    "The name of the project you'd like to configure"
  ).hideHelp()
).addOption(
  new Option(
    "--dev-deployment <mode>",
    "Use a local or cloud deployment for dev for this project"
  ).choices(["cloud", "local"]).conflicts(["--prod"]).hideHelp()
).addOption(
  new Option(
    "--prod",
    "Develop live against this project's production deployment."
  ).default(false).hideHelp()
).addOption(
  new Option(
    "--env-file <envFile>",
    `Path to a custom file of environment variables, for choosing the deployment, e.g. ${CONVEX_DEPLOYMENT_ENV_VAR_NAME} or ${CONVEX_SELF_HOSTED_URL_VAR_NAME}. Same format as .env.local or .env files, and overrides them.`
  )
).addOption(new Option("--skip-push").default(false).hideHelp()).addOption(new Option("--admin-key <adminKey>").hideHelp()).addOption(new Option("--url <url>").hideHelp()).addOption(new Option("--override-auth-url <url>").hideHelp()).addOption(new Option("--override-auth-client <id>").hideHelp()).addOption(new Option("--override-auth-username <username>").hideHelp()).addOption(new Option("--override-auth-password <password>").hideHelp()).addOption(new Option("--local-cloud-port <port>").hideHelp()).addOption(new Option("--local-site-port <port>").hideHelp()).addOption(new Option("--local-backend-version <version>").hideHelp()).addOption(new Option("--local-force-upgrade").default(false).hideHelp()).addOption(
  new Option(
    "--local",
    "Use local deployment regardless of last used backend. DB data will not be downloaded from any cloud deployment."
  ).default(false).conflicts(["--prod", "--url", "--admin-key", "--cloud"]).hideHelp()
).addOption(
  new Option(
    "--cloud",
    "Use cloud deployment regardles of last used backend. DB data will not be uploaded from local."
  ).default(false).conflicts(["--prod", "--url", "--admin-key", "--local"]).hideHelp()
).showHelpAfterError().action(async (cmdOptions) => {
  const ctx = await oneoffContext(cmdOptions);
  process.on("SIGINT", async () => {
    logVerbose("Received SIGINT, cleaning up...");
    await ctx.flushAndExit(-2);
  });
  await detectSuspiciousEnvironmentVariables(
    ctx,
    !!process.env.CONVEX_IGNORE_SUSPICIOUS_ENV_VARS
  );
  const devOptions = await normalizeDevOptions(ctx, cmdOptions);
  const selectionWithinProject = deploymentSelectionWithinProjectFromOptions(cmdOptions);
  if (cmdOptions.configure === void 0) {
    if (cmdOptions.team || cmdOptions.project || cmdOptions.devDeployment)
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "`--team, --project, and --dev-deployment can can only be used with `--configure`."
      });
  }
  const localOptions = { forceUpgrade: false };
  if (!cmdOptions.local && cmdOptions.devDeployment !== "local") {
    if (cmdOptions.localCloudPort !== void 0 || cmdOptions.localSitePort !== void 0 || cmdOptions.localBackendVersion !== void 0 || cmdOptions.localForceUpgrade === true) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "`--local-*` options can only be used with `--configure --dev-deployment local` or `--local`."
      });
    }
  } else {
    if (cmdOptions.localCloudPort !== void 0) {
      if (cmdOptions.localSitePort === void 0) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "`--local-cloud-port` requires `--local-site-port` to be set."
        });
      }
      localOptions["ports"] = {
        cloud: parseInt(cmdOptions.localCloudPort),
        site: parseInt(cmdOptions.localSitePort)
      };
    }
    localOptions["backendVersion"] = cmdOptions.localBackendVersion;
    localOptions["forceUpgrade"] = cmdOptions.localForceUpgrade;
  }
  const configure = cmdOptions.configure === true ? "ask" : cmdOptions.configure ?? null;
  const deploymentSelection = await getDeploymentSelection(ctx, cmdOptions);
  const credentials = await deploymentCredentialsOrConfigure(
    ctx,
    deploymentSelection,
    configure,
    {
      ...cmdOptions,
      localOptions,
      selectionWithinProject
    }
  );
  await Promise.all([
    ...!cmdOptions.skipPush ? [
      devAgainstDeployment(
        ctx,
        {
          url: credentials.url,
          adminKey: credentials.adminKey,
          deploymentName: credentials.deploymentFields?.deploymentName ?? null
        },
        devOptions
      )
    ] : [],
    ...credentials.deploymentFields !== null ? [
      usageStateWarning(ctx, credentials.deploymentFields.deploymentName),
      checkVersion()
    ] : []
  ]);
});
//# sourceMappingURL=dev.js.map
