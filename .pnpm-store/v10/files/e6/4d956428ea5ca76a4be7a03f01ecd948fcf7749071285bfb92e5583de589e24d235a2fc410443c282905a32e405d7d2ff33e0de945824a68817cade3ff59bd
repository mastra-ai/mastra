import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { logFinishedStep } from "../bundler/log.js";
import { deploymentCredentialsOrConfigure } from "./configure.js";
import {
  modifyGlobalConfig,
  readGlobalConfig,
} from "./lib/utils/globalConfig.js";
import {
  deploymentNameAndTypeFromSelection,
  getDeploymentSelection,
} from "./lib/deploymentSelection.js";

export const disableLocalDeployments = new Command("disable-local-deployments")
  .description(
    "Stop using a local deployment for the current project, or globally disable local depoyments with --global",
  )
  .option(
    "--global",
    "Disable local deployments on this machine until a future release when this feature is more stable.",
  )
  .option("--undo-global", "Re-enable local deployments on this machine.")
  .allowExcessArguments(false)
  .action(async (cmdOptions) => {
    const ctx = await oneoffContext({
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });

    if (cmdOptions.undoGlobal) {
      return disableLocalDeploymentsGloballyUntilBetaOver(true);
    }
    if (cmdOptions.global) {
      return disableLocalDeploymentsGloballyUntilBetaOver(
        !!cmdOptions.undoGlobal,
      );
    }

    const deploymentSelection = await getDeploymentSelection(ctx, {
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });
    const configuredDeployment =
      deploymentNameAndTypeFromSelection(deploymentSelection);
    if (
      configuredDeployment?.type !== null &&
      configuredDeployment?.type !== "local"
    ) {
      logFinishedStep("Local development is already not being used.");
      return;
    }

    await deploymentCredentialsOrConfigure(ctx, deploymentSelection, "ask", {
      selectionWithinProject: { kind: "ownDev" },
      prod: false,
      localOptions: {
        forceUpgrade: false,
      },
      cloud: true,
    });

    logFinishedStep(
      "You are no longer using a local deployment for development.",
    );
  });

async function disableLocalDeploymentsGloballyUntilBetaOver(
  reenable: boolean,
): Promise<void> {
  const ctx = await oneoffContext({
    url: undefined,
    adminKey: undefined,
    envFile: undefined,
  });

  // Ensure this is not used in CI or scripts, since it has global effects and will be deprecated
  // in the future.
  if (!process.stdin.isTTY) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage:
        "`disable-local-deployments --global` is not for scripting, it is temporary and only for interactive use.",
    });
  }
  const config = readGlobalConfig(ctx);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Log in first with `npx convex login",
    });
  }

  if (reenable) {
    if (
      !("optOutOfLocalDevDeploymentsUntilBetaOver" in config) ||
      !config.optOutOfLocalDevDeploymentsUntilBetaOver
    ) {
      logFinishedStep(
        "You are already opted into allowing local deployents on this machine.",
      );
      return;
    }
    await modifyGlobalConfig(ctx, {
      ...config,
      optOutOfLocalDevDeploymentsUntilBetaOver: false,
    });

    logFinishedStep(
      "You have been opted back into allowing local deployents on this machine.",
    );
    return;
  }

  if (
    "optOutOfLocalDevDeploymentsUntilBetaOver" in config &&
    config.optOutOfLocalDevDeploymentsUntilBetaOver
  ) {
    logFinishedStep(
      "You are already opted out of local deployents on this machine.",
    );
    return;
  }
  await modifyGlobalConfig(ctx, {
    ...config,
    optOutOfLocalDevDeploymentsUntilBetaOver: true,
  });

  logFinishedStep(
    "You have been opted out of local deployents on this machine until the beta is over. Run `npx convex disable-local-deployments --undo-global` to opt back in.",
  );
}
