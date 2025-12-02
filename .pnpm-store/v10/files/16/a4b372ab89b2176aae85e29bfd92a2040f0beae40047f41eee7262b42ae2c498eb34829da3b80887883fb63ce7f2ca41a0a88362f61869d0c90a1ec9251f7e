"use strict";
import path from "path";
import { cacheDir, rootDirectory } from "../utils/utils.js";
import { logVerbose } from "../../../bundler/log.js";
import { recursivelyDelete } from "../fsUtils.js";
import crypto from "crypto";
export function rootDeploymentStateDir(kind) {
  return path.join(
    rootDirectory(),
    kind === "local" ? "convex-backend-state" : "anonymous-convex-backend-state"
  );
}
export function deploymentStateDir(deploymentKind, deploymentName) {
  return path.join(rootDeploymentStateDir(deploymentKind), deploymentName);
}
export function loadDeploymentConfig(ctx, deploymentKind, deploymentName) {
  const dir = deploymentStateDir(deploymentKind, deploymentName);
  const configFile = path.join(dir, "config.json");
  if (!ctx.fs.exists(dir) || !ctx.fs.stat(dir).isDirectory()) {
    logVerbose(`Deployment ${deploymentName} not found`);
    return null;
  }
  if (ctx.fs.exists(configFile)) {
    const content = ctx.fs.readUtf8File(configFile);
    try {
      return JSON.parse(content);
    } catch (e) {
      logVerbose(`Failed to parse local deployment config: ${e}`);
      return null;
    }
  }
  return null;
}
export function saveDeploymentConfig(ctx, deploymentKind, deploymentName, config) {
  const dir = deploymentStateDir(deploymentKind, deploymentName);
  const configFile = path.join(dir, "config.json");
  if (!ctx.fs.exists(dir)) {
    ctx.fs.mkdir(dir, { recursive: true });
  }
  ctx.fs.writeUtf8File(configFile, JSON.stringify(config));
}
export function binariesDir() {
  return path.join(cacheDir(), "binaries");
}
export function dashboardZip() {
  return path.join(dashboardDir(), "dashboard.zip");
}
export function versionedBinaryDir(version) {
  return path.join(binariesDir(), version);
}
export function executablePath(version) {
  return path.join(versionedBinaryDir(version), executableName());
}
export function executableName() {
  const ext = process.platform === "win32" ? ".exe" : "";
  return `convex-local-backend${ext}`;
}
export function dashboardDir() {
  return path.join(cacheDir(), "dashboard");
}
export async function resetDashboardDir(ctx) {
  const dir = dashboardDir();
  if (ctx.fs.exists(dir)) {
    await recursivelyDelete(ctx, dir);
  }
  ctx.fs.mkdir(dir, { recursive: true });
}
export function dashboardOutDir() {
  return path.join(dashboardDir(), "out");
}
export function loadDashboardConfig(ctx) {
  const configFile = path.join(dashboardDir(), "config.json");
  if (!ctx.fs.exists(configFile)) {
    return null;
  }
  const content = ctx.fs.readUtf8File(configFile);
  try {
    return JSON.parse(content);
  } catch (e) {
    logVerbose(`Failed to parse dashboard config: ${e}`);
    return null;
  }
}
export function saveDashboardConfig(ctx, config) {
  const configFile = path.join(dashboardDir(), "config.json");
  if (!ctx.fs.exists(dashboardDir())) {
    ctx.fs.mkdir(dashboardDir(), { recursive: true });
  }
  ctx.fs.writeUtf8File(configFile, JSON.stringify(config));
}
export function loadUuidForAnonymousUser(ctx) {
  const configFile = path.join(
    rootDeploymentStateDir("anonymous"),
    "config.json"
  );
  if (!ctx.fs.exists(configFile)) {
    return null;
  }
  const content = ctx.fs.readUtf8File(configFile);
  try {
    const config = JSON.parse(content);
    return config.uuid ?? null;
  } catch (e) {
    logVerbose(`Failed to parse uuid for anonymous user: ${e}`);
    return null;
  }
}
export function ensureUuidForAnonymousUser(ctx) {
  const uuid = loadUuidForAnonymousUser(ctx);
  if (uuid) {
    return uuid;
  }
  const newUuid = crypto.randomUUID();
  const anonymousDir = rootDeploymentStateDir("anonymous");
  if (!ctx.fs.exists(anonymousDir)) {
    ctx.fs.mkdir(anonymousDir, { recursive: true });
  }
  ctx.fs.writeUtf8File(
    path.join(anonymousDir, "config.json"),
    JSON.stringify({ uuid: newUuid })
  );
  return newUuid;
}
//# sourceMappingURL=filePaths.js.map
