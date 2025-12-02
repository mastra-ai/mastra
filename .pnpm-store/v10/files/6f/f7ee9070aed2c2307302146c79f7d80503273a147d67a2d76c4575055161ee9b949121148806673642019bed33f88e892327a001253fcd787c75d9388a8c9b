"use strict";
import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { logMessage } from "../bundler/log.js";
import {
  getDeploymentSelection
} from "./lib/deploymentSelection.js";
import { fetchTeamAndProject } from "./lib/api.js";
export const deployments = new Command("deployments").description("List deployments associated with a project").allowExcessArguments(false).action(async () => {
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const deploymentSelection = await getDeploymentSelection(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await displayCurrentDeploymentInfo(ctx, deploymentSelection);
});
async function displayCurrentDeploymentInfo(ctx, selection) {
  logMessage("Currently configured deployment:");
  switch (selection.kind) {
    case "existingDeployment": {
      const { deploymentToActOn } = selection;
      logMessage(`  URL: ${deploymentToActOn.url}`);
      if (deploymentToActOn.deploymentFields) {
        const fields = deploymentToActOn.deploymentFields;
        logMessage(
          `  Deployment: ${fields.deploymentName} (${fields.deploymentType})`
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
          targetProject.deploymentName
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
//# sourceMappingURL=deployments.js.map
