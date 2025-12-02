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
var dashboard_exports = {};
__export(dashboard_exports, {
  DASHBOARD_HOST: () => DASHBOARD_HOST,
  dashboard: () => dashboard
});
module.exports = __toCommonJS(dashboard_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = __toESM(require("chalk"), 1);
var import_open = __toESM(require("open"), 1);
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
var import_dashboard = require("./lib/localDeployment/dashboard.js");
var import_dashboard2 = require("./lib/dashboard.js");
var import_deployment = require("./lib/deployment.js");
const DASHBOARD_HOST = process.env.CONVEX_PROVISION_HOST ? "http://localhost:6789" : "https://dashboard.convex.dev";
const dashboard = new import_extra_typings.Command("dashboard").alias("dash").description("Open the dashboard in the browser").allowExcessArguments(false).option(
  "--no-open",
  "Don't automatically open the dashboard in the default browser"
).addDeploymentSelectionOptions((0, import_command.actionDescription)("Open the dashboard for")).showHelpAfterError().action(async (options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject,
    { ensureLocalRunning: false }
  );
  if (deployment.deploymentFields === null) {
    const msg = `Self-hosted deployment configured.
\`${import_chalk.default.bold("npx convex dashboard")}\` is not supported for self-hosted deployments.
See self-hosting instructions for how to self-host the dashboard.`;
    (0, import_log.logMessage)(import_chalk.default.yellow(msg));
    return;
  }
  const dashboardUrl = (0, import_dashboard2.getDashboardUrl)(ctx, deployment.deploymentFields);
  if ((0, import_deployment.isAnonymousDeployment)(deployment.deploymentFields.deploymentName)) {
    const warningMessage = `You are not currently running the dashboard locally. Make sure \`npx convex dev\` is running and try again.`;
    if (dashboardUrl === null) {
      (0, import_log.logWarning)(warningMessage);
      return;
    }
    const isLocalDashboardRunning = await (0, import_dashboard.checkIfDashboardIsRunning)(ctx);
    if (!isLocalDashboardRunning) {
      (0, import_log.logWarning)(warningMessage);
      return;
    }
    await logOrOpenUrl(ctx, dashboardUrl, options.open);
    return;
  }
  await logOrOpenUrl(ctx, dashboardUrl ?? DASHBOARD_HOST, options.open);
});
async function logOrOpenUrl(ctx, url, shouldOpen) {
  if (shouldOpen) {
    (0, import_log.logMessage)(import_chalk.default.gray(`Opening ${url} in the default browser...`));
    try {
      await (0, import_open.default)(url);
    } catch {
      (0, import_log.logWarning)(
        `\u26A0\uFE0F Could not open dashboard in the default browser.
Please visit: ${url}`
      );
    }
  } else {
    (0, import_log.logOutput)(url);
  }
}
//# sourceMappingURL=dashboard.js.map
