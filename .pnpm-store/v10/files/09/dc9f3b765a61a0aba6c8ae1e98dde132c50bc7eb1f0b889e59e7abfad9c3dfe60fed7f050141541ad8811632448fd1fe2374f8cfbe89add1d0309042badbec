"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dashboard_exports = {};
__export(dashboard_exports, {
  DASHBOARD_HOST: () => DASHBOARD_HOST,
  deploymentDashboardUrl: () => deploymentDashboardUrl,
  deploymentDashboardUrlPage: () => deploymentDashboardUrlPage,
  getDashboardUrl: () => getDashboardUrl,
  projectDashboardUrl: () => projectDashboardUrl,
  teamDashboardUrl: () => teamDashboardUrl
});
module.exports = __toCommonJS(dashboard_exports);
var import_dashboard = require("./localDeployment/dashboard.js");
const DASHBOARD_HOST = process.env.CONVEX_PROVISION_HOST ? "http://localhost:6789" : "https://dashboard.convex.dev";
function getDashboardUrl(ctx, {
  deploymentName,
  deploymentType
}) {
  switch (deploymentType) {
    case "anonymous": {
      return (0, import_dashboard.dashboardUrl)(ctx, deploymentName);
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
function deploymentDashboardUrlPage(configuredDeployment, page) {
  const deploymentFrag = configuredDeployment ? `/d/${configuredDeployment}` : "";
  return `${DASHBOARD_HOST}${deploymentFrag}${page}`;
}
function deploymentDashboardUrl(team, project, deploymentName) {
  return `${projectDashboardUrl(team, project)}/${deploymentName}`;
}
function projectDashboardUrl(team, project) {
  return `${teamDashboardUrl(team)}/${project}`;
}
function teamDashboardUrl(team) {
  return `${DASHBOARD_HOST}/t/${team}`;
}
//# sourceMappingURL=dashboard.js.map
