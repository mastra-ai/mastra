import { Context } from "../../bundler/context.js";
import { DeploymentType } from "./api.js";
import { dashboardUrl as localDashboardUrl } from "./localDeployment/dashboard.js";

export const DASHBOARD_HOST = process.env.CONVEX_PROVISION_HOST
  ? "http://localhost:6789"
  : "https://dashboard.convex.dev";

export function getDashboardUrl(
  ctx: Context,
  {
    deploymentName,
    deploymentType,
  }: {
    deploymentName: string;
    deploymentType: DeploymentType;
  },
): string | null {
  switch (deploymentType) {
    case "anonymous": {
      return localDashboardUrl(ctx, deploymentName);
    }
    case "local":
    case "dev":
    case "prod":
    case "preview":
      return deploymentDashboardUrlPage(deploymentName, "");
    default: {
      return deploymentType satisfies never;
    }
  }
}

export function deploymentDashboardUrlPage(
  configuredDeployment: string | null,
  page: string,
): string {
  const deploymentFrag = configuredDeployment
    ? `/d/${configuredDeployment}`
    : "";
  return `${DASHBOARD_HOST}${deploymentFrag}${page}`;
}

export function deploymentDashboardUrl(
  team: string,
  project: string,
  deploymentName: string,
) {
  return `${projectDashboardUrl(team, project)}/${deploymentName}`;
}

export function projectDashboardUrl(team: string, project: string) {
  return `${teamDashboardUrl(team)}/${project}`;
}

export function teamDashboardUrl(team: string) {
  return `${DASHBOARD_HOST}/t/${team}`;
}
