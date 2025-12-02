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
  DEFAULT_LOCAL_DASHBOARD_API_PORT: () => DEFAULT_LOCAL_DASHBOARD_API_PORT,
  DEFAULT_LOCAL_DASHBOARD_PORT: () => DEFAULT_LOCAL_DASHBOARD_PORT,
  checkIfDashboardIsRunning: () => checkIfDashboardIsRunning,
  dashboardUrl: () => dashboardUrl,
  handleDashboard: () => handleDashboard
});
module.exports = __toCommonJS(dashboard_exports);
var import_filePaths = require("./filePaths.js");
var import_utils = require("./utils.js");
var import_serve = require("./serve.js");
var import_anonymous = require("./anonymous.js");
var import_run = require("./run.js");
var import_serve_handler = __toESM(require("serve-handler"), 1);
var import_download = require("./download.js");
var import_utils2 = require("../utils/utils.js");
const DEFAULT_LOCAL_DASHBOARD_PORT = 6790;
const DEFAULT_LOCAL_DASHBOARD_API_PORT = 6791;
async function handleDashboard(ctx, version) {
  const anonymousId = (0, import_filePaths.loadUuidForAnonymousUser)(ctx) ?? void 0;
  const isRunning = await checkIfDashboardIsRunning(ctx);
  if (isRunning) {
    return;
  }
  await (0, import_download.ensureDashboardDownloaded)(ctx, version);
  const [dashboardPort, apiPort] = await (0, import_utils.choosePorts)(ctx, {
    count: 2,
    startPort: DEFAULT_LOCAL_DASHBOARD_PORT,
    requestedPorts: [null, null]
  });
  await (0, import_filePaths.saveDashboardConfig)(ctx, {
    port: dashboardPort,
    apiPort,
    version
  });
  let hasReportedSelfHostedEvent = false;
  const { cleanupHandle } = await (0, import_serve.startServer)(
    ctx,
    dashboardPort,
    async (request, response) => {
      if (!hasReportedSelfHostedEvent) {
        hasReportedSelfHostedEvent = true;
        void reportSelfHostedEvent(ctx, {
          anonymousId,
          eventName: "self_host_dashboard_connected",
          tag: (0, import_run.selfHostedEventTag)("anonymous")
        });
      }
      await (0, import_serve_handler.default)(request, response, {
        public: (0, import_filePaths.dashboardOutDir)()
      });
    },
    {}
  );
  await startServingListDeploymentsApi(ctx, apiPort);
  return {
    dashboardPort,
    cleanupHandle
  };
}
async function reportSelfHostedEvent(ctx, {
  anonymousId,
  eventName,
  eventFields,
  tag
}) {
  try {
    await (0, import_utils2.bigBrainAPIMaybeThrows)({
      ctx,
      method: "POST",
      url: "self_hosted_event",
      data: {
        selfHostedUuid: anonymousId,
        eventName,
        eventFields,
        tag
      }
    });
  } catch {
  }
}
async function startServingListDeploymentsApi(ctx, port) {
  await (0, import_serve.startServer)(
    ctx,
    port,
    async (request, response) => {
      const deployments = await (0, import_anonymous.listExistingAnonymousDeployments)(ctx);
      const deploymentsJson = deployments.map((d) => ({
        name: d.deploymentName,
        url: (0, import_run.localDeploymentUrl)(d.config.ports.cloud),
        adminKey: d.config.adminKey
      }));
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ deployments: deploymentsJson }));
    },
    {
      cors: true
    }
  );
}
async function checkIfDashboardIsRunning(ctx) {
  const dashboardConfig = (0, import_filePaths.loadDashboardConfig)(ctx);
  if (dashboardConfig === null) {
    return false;
  }
  let resp;
  try {
    resp = await fetch(`http://127.0.0.1:${dashboardConfig.apiPort}`);
  } catch {
    return false;
  }
  if (!resp.ok) {
    return false;
  }
  let data;
  try {
    data = await resp.json();
  } catch {
    return false;
  }
  return Array.isArray(data.deployments);
}
function dashboardUrl(ctx, deploymentName) {
  const dashboardConfig = (0, import_filePaths.loadDashboardConfig)(ctx);
  if (dashboardConfig === null) {
    return null;
  }
  const queryParams = new URLSearchParams();
  if (dashboardConfig.apiPort !== DEFAULT_LOCAL_DASHBOARD_API_PORT) {
    queryParams.set("a", dashboardConfig.apiPort.toString());
  }
  queryParams.set("d", deploymentName);
  const queryString = queryParams.toString();
  const url = new URL(`http://127.0.0.1:${dashboardConfig.port}`);
  url.search = queryString;
  return url.href;
}
//# sourceMappingURL=dashboard.js.map
