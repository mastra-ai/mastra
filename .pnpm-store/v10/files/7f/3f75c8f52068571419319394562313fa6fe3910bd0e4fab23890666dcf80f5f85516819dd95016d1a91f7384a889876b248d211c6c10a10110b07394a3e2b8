import { Command } from "@commander-js/extra-typings";
import { oneoffContext, Context } from "../bundler/context.js";
import { logMessage } from "../bundler/log.js";
import {
  getDeploymentSelection,
  DeploymentSelection,
} from "./lib/deploymentSelection.js";
import { fetchTeamAndProject } from "./lib/api.js";

// This is a debugging command: it's output is not stable, don't write scripts
// that depend on its output.

// TODO: for the deployments command to list all deployments in a project
// we need a stable endpoint for listing projects (check) and a way to
// get a project ID in all cases to use it. We have an endpoint that lists
// deployments by team/project slug today but it's not in use and we'll
// be able to deprecate it if we avoid using it.

export const deployments = new Command("deployments")
  .description("List deployments associated with a project")
  .allowExcessArguments(false)
  .action(async () => {
    const ctx = await oneoffContext({
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });

    const deploymentSelection = await getDeploymentSelection(ctx, {
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });

    await displayCurrentDeploymentInfo(ctx, deploymentSelection);
  });

async function displayCurrentDeploymentInfo(
  ctx: Context,
  selection: DeploymentSelection,
) {
  logMessage("Currently configured deployment:");

  switch (selection.kind) {
    case "existingDeployment": {
      const { deploymentToActOn } = selection;
      logMessage(`  URL: ${deploymentToActOn.url}`);

      if (deploymentToActOn.deploymentFields) {
        const fields = deploymentToActOn.deploymentFields;
        logMessage(
          `  Deployment: ${fields.deploymentName} (${fields.deploymentType})`,
        );
        logMessage(`  Team: ${fields.teamSlug}`);
        logMessage(`  Project: ${fields.projectSlug}`);
      } else {
        logMessage(`  Type: ${deploymentToActOn.source}`);
      }
      break;
    }
    case "deploymentWithinProject": {
      const { targetProject } = selection;
      if (targetProject.kind === "teamAndProjectSlugs") {
        logMessage(`  Team: ${targetProject.teamSlug}`);
        logMessage(`  Project: ${targetProject.projectSlug}`);
      } else if (targetProject.kind === "deploymentName") {
        const slugs = await fetchTeamAndProject(
          ctx,
          targetProject.deploymentName,
        );
        logMessage(`  Team: ${slugs.team}`);
        logMessage(`  Project: ${slugs.project}`);
        logMessage(`  Deployment: ${targetProject.deploymentName}`);
        if (targetProject.deploymentType) {
          logMessage(`  Type: ${targetProject.deploymentType}`);
        }
      } else {
        logMessage(`  Project deploy key configured`);
      }
      break;
    }
    case "preview": {
      logMessage(`  Preview deployment (deploy key configured)`);
      break;
    }
    case "anonymous": {
      if (selection.deploymentName) {
        logMessage(`  Anonymous deployment: ${selection.deploymentName}`);
      } else {
        logMessage(`  Anonymous development (no deployment selected)`);
      }
      break;
    }
    case "chooseProject": {
      logMessage(`  No project configured - will prompt interactively`);
      break;
    }
    default: {
      logMessage(`  Unknown deployment configuration`);
    }
  }
}
