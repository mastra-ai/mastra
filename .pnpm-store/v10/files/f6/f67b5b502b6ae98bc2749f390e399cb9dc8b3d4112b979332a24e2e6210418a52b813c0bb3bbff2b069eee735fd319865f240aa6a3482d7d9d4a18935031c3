/*
~/.cache/convex
  binaries
    0.0.1
      convex-local-backend[.exe] // convex-local-backend.exe on windows
    0.0.2
      convex-local-backend[.exe]
  dashboard
    config.json
    out
    // if present, output files from building the self-hosted dashboard which can
    // be served using `npx serve`
    index.html


~/.convex
  convex-backend-state
    local-my_team-chess
      config.json // contains `LocalDeploymentConfig`
      convex_local_storage
      convex_local_backend.sqlite3
    local-my_team-whisper
      config.json
      convex_local_storage
      convex_local_backend.sqlite3
    anonymous-convex-backend-state
      config.json // contains { uuid: <uuid> }, used to identify the anonymous user
      anonymous-chess
        config.json
        convex_local_storage
        convex_local_backend.sqlite3
*/

import path from "path";
import { cacheDir, rootDirectory } from "../utils/utils.js";
import { Context } from "../../../bundler/context.js";
import { logVerbose } from "../../../bundler/log.js";
import { recursivelyDelete } from "../fsUtils.js";
import crypto from "crypto";

// Naming is hard, but "local" refers to deployments linked to a Convex project
// and "anonymous" refers to deployments that are not linked to a Convex project
// (but in both cases they are running locally).
export type LocalDeploymentKind = "local" | "anonymous";

export function rootDeploymentStateDir(kind: LocalDeploymentKind) {
  return path.join(
    rootDirectory(),
    kind === "local"
      ? "convex-backend-state"
      : "anonymous-convex-backend-state",
  );
}

export function deploymentStateDir(
  deploymentKind: LocalDeploymentKind,
  deploymentName: string,
) {
  return path.join(rootDeploymentStateDir(deploymentKind), deploymentName);
}

export type LocalDeploymentConfig = {
  ports: {
    cloud: number;
    site: number;
  };
  backendVersion: string;
  adminKey: string;
  // If not present, use the default instance secret for local backends
  instanceSecret?: string;
};
export function loadDeploymentConfig(
  ctx: Context,
  deploymentKind: LocalDeploymentKind,
  deploymentName: string,
): LocalDeploymentConfig | null {
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
      logVerbose(`Failed to parse local deployment config: ${e as any}`);
      return null;
    }
  }
  return null;
}

export function saveDeploymentConfig(
  ctx: Context,
  deploymentKind: LocalDeploymentKind,
  deploymentName: string,
  config: LocalDeploymentConfig,
) {
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

export function versionedBinaryDir(version: string) {
  return path.join(binariesDir(), version);
}

export function executablePath(version: string) {
  return path.join(versionedBinaryDir(version), executableName());
}

export function executableName() {
  const ext = process.platform === "win32" ? ".exe" : "";
  return `convex-local-backend${ext}`;
}

export function dashboardDir() {
  return path.join(cacheDir(), "dashboard");
}

export async function resetDashboardDir(ctx: Context) {
  const dir = dashboardDir();
  if (ctx.fs.exists(dir)) {
    await recursivelyDelete(ctx, dir);
  }
  ctx.fs.mkdir(dir, { recursive: true });
}

export function dashboardOutDir() {
  return path.join(dashboardDir(), "out");
}

export type DashboardConfig = {
  port: number;
  apiPort: number;
  version: string;
};
export function loadDashboardConfig(ctx: Context) {
  const configFile = path.join(dashboardDir(), "config.json");
  if (!ctx.fs.exists(configFile)) {
    return null;
  }
  const content = ctx.fs.readUtf8File(configFile);
  try {
    return JSON.parse(content);
  } catch (e) {
    logVerbose(`Failed to parse dashboard config: ${e as any}`);
    return null;
  }
}

export function saveDashboardConfig(ctx: Context, config: DashboardConfig) {
  const configFile = path.join(dashboardDir(), "config.json");
  if (!ctx.fs.exists(dashboardDir())) {
    ctx.fs.mkdir(dashboardDir(), { recursive: true });
  }
  ctx.fs.writeUtf8File(configFile, JSON.stringify(config));
}

export function loadUuidForAnonymousUser(ctx: Context) {
  const configFile = path.join(
    rootDeploymentStateDir("anonymous"),
    "config.json",
  );
  if (!ctx.fs.exists(configFile)) {
    return null;
  }
  const content = ctx.fs.readUtf8File(configFile);
  try {
    const config = JSON.parse(content);
    return config.uuid ?? null;
  } catch (e) {
    logVerbose(`Failed to parse uuid for anonymous user: ${e as any}`);
    return null;
  }
}

export function ensureUuidForAnonymousUser(ctx: Context) {
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
    JSON.stringify({ uuid: newUuid }),
  );
  return newUuid;
}
