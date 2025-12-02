"use strict";
import { dashboardUrl as localDashboardUrl } from "./localDeployment/dashboard.js";
export const DASHBOARD_HOST = process.env.CONVEX_PROVISION_HOST ? "http://localhost:6789" : "https://dashboard.convex.dev";
export function getDashboardUrl(ctx, {
  deploymentName,
  deploymentType
}) {
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
      return deploymentType;
    }
  }
}
export function deploymentDashboardUrlPage(configuredDeployment, page) {
  const deploymentFrag = configuredDeployment ? `/d/${configuredDeployment}` : "";
  return `${DASHBOARD_HOST}${deploymentFrag}${page}`;
}
export function deploymentDashboardUrl(team, project, deploymentName) {
  return `${projectDashboardUrl(team, project)}/${deploymentName}`;
}
export function projectDashboardUrl(team, project) {
  return `${teamDashboardUrl(team)}/${project}`;
}
export function teamDashboardUrl(team) {
  return `${DASHBOARD_HOST}/t/${team}`;
}
//# sourceMappingURL=dashboard.js.map
