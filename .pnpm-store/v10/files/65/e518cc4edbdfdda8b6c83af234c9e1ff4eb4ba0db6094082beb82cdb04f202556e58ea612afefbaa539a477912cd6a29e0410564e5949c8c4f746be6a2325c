"use strict";
import chalk from "chalk";
import { logWarning } from "../../bundler/log.js";
import { teamDashboardUrl } from "./dashboard.js";
import { fetchTeamAndProject } from "./api.js";
import { bigBrainAPI } from "./utils/utils.js";
async function warn(ctx, options) {
  const { title, subtitle, teamSlug } = options;
  logWarning(chalk.bold.yellow(title));
  logWarning(chalk.yellow(subtitle));
  logWarning(
    chalk.yellow(`Visit ${teamDashboardUrl(teamSlug)} to learn more.`)
  );
}
async function teamUsageState(ctx, teamId) {
  const { usageState } = await bigBrainAPI({
    ctx,
    method: "GET",
    url: "dashboard/teams/" + teamId + "/usage/team_usage_state"
  });
  return usageState;
}
async function teamSpendingLimitsState(ctx, teamId) {
  const response = await bigBrainAPI({
    ctx,
    method: "GET",
    url: "dashboard/teams/" + teamId + "/get_spending_limits"
  });
  return response.state;
}
export async function usageStateWarning(ctx, targetDeployment) {
  const auth = ctx.bigBrainAuth();
  if (auth === null || auth.kind === "projectKey" || auth.kind === "deploymentKey") {
    return;
  }
  const { teamId, team } = await fetchTeamAndProject(ctx, targetDeployment);
  const [usageState, spendingLimitsState] = await Promise.all([
    teamUsageState(ctx, teamId),
    teamSpendingLimitsState(ctx, teamId)
  ]);
  if (spendingLimitsState === "Disabled") {
    await warn(ctx, {
      title: "Your projects are disabled because you exceeded your spending limit.",
      subtitle: "Increase it from the dashboard to re-enable your projects.",
      teamSlug: team
    });
  } else if (usageState === "Approaching") {
    await warn(ctx, {
      title: "Your projects are approaching the Free plan limits.",
      subtitle: "Consider upgrading to avoid service interruption.",
      teamSlug: team
    });
  } else if (usageState === "Exceeded") {
    await warn(ctx, {
      title: "Your projects are above the Free plan limits.",
      subtitle: "Decrease your usage or upgrade to avoid service interruption.",
      teamSlug: team
    });
  } else if (usageState === "Disabled") {
    await warn(ctx, {
      title: "Your projects are disabled because the team exceeded Free plan limits.",
      subtitle: "Decrease your usage or upgrade to reenable your projects.",
      teamSlug: team
    });
  } else if (usageState === "Paused") {
    await warn(ctx, {
      title: "Your projects are disabled because the team previously exceeded Free plan limits.",
      subtitle: "Restore your projects by going to the dashboard.",
      teamSlug: team
    });
  }
}
//# sourceMappingURL=usage.js.map
