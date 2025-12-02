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
var filePaths_exports = {};
__export(filePaths_exports, {
  binariesDir: () => binariesDir,
  dashboardDir: () => dashboardDir,
  dashboardOutDir: () => dashboardOutDir,
  dashboardZip: () => dashboardZip,
  deploymentStateDir: () => deploymentStateDir,
  ensureUuidForAnonymousUser: () => ensureUuidForAnonymousUser,
  executableName: () => executableName,
  executablePath: () => executablePath,
  loadDashboardConfig: () => loadDashboardConfig,
  loadDeploymentConfig: () => loadDeploymentConfig,
  loadUuidForAnonymousUser: () => loadUuidForAnonymousUser,
  resetDashboardDir: () => resetDashboardDir,
  rootDeploymentStateDir: () => rootDeploymentStateDir,
  saveDashboardConfig: () => saveDashboardConfig,
  saveDeploymentConfig: () => saveDeploymentConfig,
  versionedBinaryDir: () => versionedBinaryDir
});
module.exports = __toCommonJS(filePaths_exports);
var import_path = __toESM(require("path"), 1);
var import_utils = require("../utils/utils.js");
var import_log = require("../../../bundler/log.js");
var import_fsUtils = require("../fsUtils.js");
var import_crypto = __toESM(require("crypto"), 1);
function rootDeploymentStateDir(kind) {
  return import_path.default.join(
    (0, import_utils.rootDirectory)(),
    kind === "local" ? "convex-backend-state" : "anonymous-convex-backend-state"
  );
}
function deploymentStateDir(deploymentKind, deploymentName) {
  return import_path.default.join(rootDeploymentStateDir(deploymentKind), deploymentName);
}
function loadDeploymentConfig(ctx, deploymentKind, deploymentName) {
  const dir = deploymentStateDir(deploymentKind, deploymentName);
  const configFile = import_path.default.join(dir, "config.json");
  if (!ctx.fs.exists(dir) || !ctx.fs.stat(dir).isDirectory()) {
    (0, import_log.logVerbose)(`Deployment ${deploymentName} not found`);
    return null;
  }
  if (ctx.fs.exists(configFile)) {
    const content = ctx.fs.readUtf8File(configFile);
    try {
      return JSON.parse(content);
    } catch (e) {
      (0, import_log.logVerbose)(`Failed to parse local deployment config: ${e}`);
      return null;
    }
  }
  return null;
}
function saveDeploymentConfig(ctx, deploymentKind, deploymentName, config) {
  const dir = deploymentStateDir(deploymentKind, deploymentName);
  const configFile = import_path.default.join(dir, "config.json");
  if (!ctx.fs.exists(dir)) {
    ctx.fs.mkdir(dir, { recursive: true });
  }
  ctx.fs.writeUtf8File(configFile, JSON.stringify(config));
}
function binariesDir() {
  return import_path.default.join((0, import_utils.cacheDir)(), "binaries");
}
function dashboardZip() {
  return import_path.default.join(dashboardDir(), "dashboard.zip");
}
function versionedBinaryDir(version) {
  return import_path.default.join(binariesDir(), version);
}
function executablePath(version) {
  return import_path.default.join(versionedBinaryDir(version), executableName());
}
function executableName() {
  const ext = process.platform === "win32" ? ".exe" : "";
  return `convex-local-backend${ext}`;
}
function dashboardDir() {
  return import_path.default.join((0, import_utils.cacheDir)(), "dashboard");
}
async function resetDashboardDir(ctx) {
  const dir = dashboardDir();
  if (ctx.fs.exists(dir)) {
    await (0, import_fsUtils.recursivelyDelete)(ctx, dir);
  }
  ctx.fs.mkdir(dir, { recursive: true });
}
function dashboardOutDir() {
  return import_path.default.join(dashboardDir(), "out");
}
function loadDashboardConfig(ctx) {
  const configFile = import_path.default.join(dashboardDir(), "config.json");
  if (!ctx.fs.exists(configFile)) {
    return null;
  }
  const content = ctx.fs.readUtf8File(configFile);
  try {
    return JSON.parse(content);
  } catch (e) {
    (0, import_log.logVerbose)(`Failed to parse dashboard config: ${e}`);
    return null;
  }
}
function saveDashboardConfig(ctx, config) {
  const configFile = import_path.default.join(dashboardDir(), "config.json");
  if (!ctx.fs.exists(dashboardDir())) {
    ctx.fs.mkdir(dashboardDir(), { recursive: true });
  }
  ctx.fs.writeUtf8File(configFile, JSON.stringify(config));
}
function loadUuidForAnonymousUser(ctx) {
  const configFile = import_path.default.join(
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
    (0, import_log.logVerbose)(`Failed to parse uuid for anonymous user: ${e}`);
    return null;
  }
}
function ensureUuidForAnonymousUser(ctx) {
  const uuid = loadUuidForAnonymousUser(ctx);
  if (uuid) {
    return uuid;
  }
  const newUuid = import_crypto.default.randomUUID();
  const anonymousDir = rootDeploymentStateDir("anonymous");
  if (!ctx.fs.exists(anonymousDir)) {
    ctx.fs.mkdir(anonymousDir, { recursive: true });
  }
  ctx.fs.writeUtf8File(
    import_path.default.join(anonymousDir, "config.json"),
    JSON.stringify({ uuid: newUuid })
  );
  return newUuid;
}
//# sourceMappingURL=filePaths.js.map
