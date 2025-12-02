/**
 * Debugging commands for the WorkOS integration; these are unstable, undocumented, and will change or disappear as the WorkOS integration evolves.
 **/
import { Command } from "@commander-js/extra-typings";
import { Context, oneoffContext } from "../bundler/context.js";
import chalk from "chalk";
import {
  DeploymentSelectionOptions,
  deploymentSelectionWithinProjectFromOptions,
  getTeamAndProjectSlugForDeployment,
  loadSelectedDeploymentCredentials,
} from "./lib/api.js";
import { actionDescription } from "./lib/command.js";
import { ensureHasConvexDependency } from "./lib/utils/utils.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
import { ensureWorkosEnvironmentProvisioned } from "./lib/workos/workos.js";
import {
  getCandidateEmailsForWorkIntegration,
  getDeploymentCanProvisionWorkOSEnvironments,
} from "./lib/workos/platformApi.js";
import { logMessage } from "../bundler/log.js";

async function selectEnvDeployment(
  options: DeploymentSelectionOptions,
): Promise<{
  ctx: Context;
  deployment: {
    deploymentUrl: string;
    deploymentName: string;
    adminKey: string;
    deploymentNotice: string;
  };
}> {
  const ctx = await oneoffContext(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  const selectionWithinProject =
    deploymentSelectionWithinProjectFromOptions(options);
  const {
    adminKey,
    url: deploymentUrl,
    deploymentFields,
  } = await loadSelectedDeploymentCredentials(
    ctx,
    deploymentSelection,
    selectionWithinProject,
  );
  const deploymentNotice =
    deploymentFields !== null
      ? ` (on ${chalk.bold(deploymentFields.deploymentType)} deployment ${chalk.bold(deploymentFields.deploymentName)})`
      : "";
  return {
    ctx,
    deployment: {
      deploymentName: deploymentFields!.deploymentName,
      deploymentUrl,
      adminKey,
      deploymentNotice,
    },
  };
}

const workosTeamStatus = new Command("status")
  .summary("Status of associated WorkOS team")
  .action(async (_options, cmd) => {
    const options = cmd.optsWithGlobals();
    const { ctx, deployment } = await selectEnvDeployment(options);

    const { hasAssociatedWorkosTeam } =
      await getDeploymentCanProvisionWorkOSEnvironments(
        ctx,
        deployment.deploymentName,
      );

    const info = await getTeamAndProjectSlugForDeployment(ctx, {
      deploymentName: deployment.deploymentName,
    });

    const { availableEmails } = await getCandidateEmailsForWorkIntegration(ctx);

    if (!hasAssociatedWorkosTeam) {
      logMessage(
        `Convex team ${info?.teamSlug} does not have an associated WorkOS team.`,
      );
      logMessage(
        `Verified emails that mighe be able to add one: ${availableEmails.join(" ")}`,
      );
      return;
    }

    logMessage(`Convex team ${info?.teamSlug} has an associated WorkOS team.`);
  });

const workosProvisionEnvironment = new Command("provision-environment")
  .summary("Provision a WorkOS environment")
  .description(
    "Create or get the WorkOS environment and API key for this deployment",
  )
  .configureHelp({ showGlobalOptions: true })
  .allowExcessArguments(false)
  .addDeploymentSelectionOptions(
    actionDescription("Provision WorkOS environment for"),
  )
  .action(async (_options, cmd) => {
    const options = cmd.optsWithGlobals();
    const { ctx, deployment } = await selectEnvDeployment(options);
    await ensureHasConvexDependency(
      ctx,
      "integration workos provision-environment",
    );

    try {
      await ensureWorkosEnvironmentProvisioned(
        ctx,
        deployment.deploymentName,
        deployment,
        {
          offerToAssociateWorkOSTeam: true,
          autoProvisionIfWorkOSTeamAssociated: true,
          autoConfigureAuthkitConfig: true,
        },
      );
    } catch (error) {
      await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        errForSentry: error,
        printedMessage: `Failed to provision WorkOS environment: ${String(error)}`,
      });
    }
  });
const workos = new Command("workos")
  .summary("WorkOS integration commands")
  .description("Manage WorkOS team provisioning and environment setup")
  .addCommand(workosProvisionEnvironment)
  .addCommand(workosTeamStatus);

export const integration = new Command("integration")
  .summary("Integration commands")
  .description("Commands for managing third-party integrations")
  .addCommand(workos);
