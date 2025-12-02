"use strict";
import {
  dashboardOutDir,
  loadDashboardConfig,
  loadUuidForAnonymousUser,
  saveDashboardConfig
} from "./filePaths.js";
import { choosePorts } from "./utils.js";
import { startServer } from "./serve.js";
import { listExistingAnonymousDeployments } from "./anonymous.js";
import { localDeploymentUrl, selfHostedEventTag } from "./run.js";
import serveHandler from "serve-handler";
import { ensureDashboardDownloaded } from "./download.js";
import { bigBrainAPIMaybeThrows } from "../utils/utils.js";
export const DEFAULT_LOCAL_DASHBOARD_PORT = 6790;
export const DEFAULT_LOCAL_DASHBOARD_API_PORT = 6791;
export async function handleDashboard(ctx, version) {
  const anonymousId = loadUuidForAnonymousUser(ctx) ?? void 0;
  const isRunning = await checkIfDashboardIsRunning(ctx);
  if (isRunning) {
    return;
  }
  await ensureDashboardDownloaded(ctx, version);
  const [dashboardPort, apiPort] = await choosePorts(ctx, {
    count: 2,
    startPort: DEFAULT_LOCAL_DASHBOARD_PORT,
    requestedPorts: [null, null]
  });
  await saveDashboardConfig(ctx, {
    port: dashboardPort,
    apiPort,
    version
  });
  let hasReportedSelfHostedEvent = false;
  const { cleanupHandle } = await startServer(
    ctx,
    dashboardPort,
    async (request, response) => {
      if (!hasReportedSelfHostedEvent) {
        hasReportedSelfHostedEvent = true;
        void reportSelfHostedEvent(ctx, {
          anonymousId,
          eventName: "self_host_dashboard_connected",
          tag: selfHostedEventTag("anonymous")
        });
      }
      await serveHandler(request, response, {
        public: dashboardOutDir()
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
    await bigBrainAPIMaybeThrows({
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
  await startServer(
    ctx,
    port,
    async (request, response) => {
      const deployments = await listExistingAnonymousDeployments(ctx);
      const deploymentsJson = deployments.map((d) => ({
        name: d.deploymentName,
        url: localDeploymentUrl(d.config.ports.cloud),
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
export async function checkIfDashboardIsRunning(ctx) {
  const dashboardConfig = loadDashboardConfig(ctx);
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
export function dashboardUrl(ctx, deploymentName) {
  const dashboardConfig = loadDashboardConfig(ctx);
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
