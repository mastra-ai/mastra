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
var deployment_exports = {};
__export(deployment_exports, {
  changesToEnvVarFile: () => changesToEnvVarFile,
  changesToGitIgnore: () => changesToGitIgnore,
  deploymentNameFromAdminKeyOrCrash: () => deploymentNameFromAdminKeyOrCrash,
  deploymentTypeFromAdminKey: () => deploymentTypeFromAdminKey,
  eraseDeploymentEnvVar: () => eraseDeploymentEnvVar,
  getDeploymentTypeFromConfiguredDeployment: () => getDeploymentTypeFromConfiguredDeployment,
  getTeamAndProjectFromPreviewAdminKey: () => getTeamAndProjectFromPreviewAdminKey,
  isAnonymousDeployment: () => isAnonymousDeployment,
  isDeploymentKey: () => isDeploymentKey,
  isPreviewDeployKey: () => isPreviewDeployKey,
  isProjectKey: () => isProjectKey,
  removeAnonymousPrefix: () => removeAnonymousPrefix,
  stripDeploymentTypePrefix: () => stripDeploymentTypePrefix,
  writeDeploymentEnvVar: () => writeDeploymentEnvVar
});
module.exports = __toCommonJS(deployment_exports);
var dotenv = __toESM(require("dotenv"), 1);
var import_envvars = require("./envvars.js");
var import_utils = require("./utils/utils.js");
function stripDeploymentTypePrefix(deployment) {
  return deployment.split(":").at(-1);
}
function getDeploymentTypeFromConfiguredDeployment(raw) {
  const typeRaw = raw.split(":")[0];
  const type = typeRaw === "prod" || typeRaw === "dev" || typeRaw === "preview" || typeRaw === "local" ? typeRaw : null;
  return type;
}
function isAnonymousDeployment(deploymentName) {
  return deploymentName.startsWith("anonymous-");
}
function removeAnonymousPrefix(deploymentName) {
  if (isAnonymousDeployment(deploymentName)) {
    return deploymentName.slice("anonymous-".length);
  }
  return deploymentName;
}
async function writeDeploymentEnvVar(ctx, deploymentType, deployment, existingValue) {
  const existingFile = ctx.fs.exists(import_utils.ENV_VAR_FILE_PATH) ? ctx.fs.readUtf8File(import_utils.ENV_VAR_FILE_PATH) : null;
  const changedFile = changesToEnvVarFile(
    existingFile,
    deploymentType,
    deployment
  );
  const deploymentEnvVarValue = deploymentType + ":" + deployment.deploymentName;
  const changedDeploymentEnvVar = existingValue !== deployment.deploymentName && existingValue !== deploymentEnvVarValue;
  if (changedFile !== null) {
    ctx.fs.writeUtf8File(import_utils.ENV_VAR_FILE_PATH, changedFile);
    return {
      wroteToGitIgnore: await gitIgnoreEnvVarFile(ctx),
      changedDeploymentEnvVar
    };
  }
  return {
    wroteToGitIgnore: false,
    changedDeploymentEnvVar
  };
}
async function eraseDeploymentEnvVar(ctx) {
  const existingFile = ctx.fs.exists(import_utils.ENV_VAR_FILE_PATH) ? ctx.fs.readUtf8File(import_utils.ENV_VAR_FILE_PATH) : null;
  if (existingFile === null) {
    return false;
  }
  const config = dotenv.parse(existingFile);
  const existing = config[import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME];
  if (existing === void 0) {
    return false;
  }
  const changedFile = existingFile.replace(
    (0, import_envvars.getEnvVarRegex)(import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME),
    ""
  );
  ctx.fs.writeUtf8File(import_utils.ENV_VAR_FILE_PATH, changedFile);
  return true;
}
async function gitIgnoreEnvVarFile(ctx) {
  const gitIgnorePath = ".gitignore";
  const gitIgnoreContents = ctx.fs.exists(gitIgnorePath) ? ctx.fs.readUtf8File(gitIgnorePath) : "";
  const changedGitIgnore = changesToGitIgnore(gitIgnoreContents);
  if (changedGitIgnore !== null) {
    ctx.fs.writeUtf8File(gitIgnorePath, changedGitIgnore);
    return true;
  }
  return false;
}
function changesToEnvVarFile(existingFile, deploymentType, {
  team,
  project,
  deploymentName
}) {
  const deploymentValue = deploymentType + ":" + deploymentName;
  const commentOnPreviousLine = "# Deployment used by `npx convex dev`";
  const commentAfterValue = team !== null && project !== null ? `team: ${team}, project: ${project}` : null;
  return (0, import_envvars.changedEnvVarFile)({
    existingFileContent: existingFile,
    envVarName: import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME,
    envVarValue: deploymentValue,
    commentAfterValue,
    commentOnPreviousLine
  });
}
function changesToGitIgnore(existingFile) {
  if (existingFile === null) {
    return `${import_utils.ENV_VAR_FILE_PATH}
`;
  }
  const gitIgnoreLines = existingFile.split("\n");
  const envVarFileIgnored = gitIgnoreLines.some((line) => {
    if (line.startsWith("#")) return false;
    if (line.startsWith("!")) return false;
    const trimmedLine = line.trimEnd();
    const envIgnorePatterns = [
      /^\.env\.local$/,
      /^\.env\.\*$/,
      /^\.env\*$/,
      /^.*\.local$/,
      /^\.env\*\.local$/
    ];
    return envIgnorePatterns.some((pattern) => pattern.test(trimmedLine));
  });
  if (!envVarFileIgnored) {
    return `${existingFile}
${import_utils.ENV_VAR_FILE_PATH}
`;
  } else {
    return null;
  }
}
async function deploymentNameFromAdminKeyOrCrash(ctx, adminKey) {
  const deploymentName = deploymentNameFromAdminKey(adminKey);
  if (deploymentName === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Please set ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME} to a new key which you can find on your Convex dashboard.`
    });
  }
  return deploymentName;
}
function deploymentNameFromAdminKey(adminKey) {
  const parts = adminKey.split("|");
  if (parts.length === 1) {
    return null;
  }
  if (isPreviewDeployKey(adminKey)) {
    return null;
  }
  return stripDeploymentTypePrefix(parts[0]);
}
function isPreviewDeployKey(adminKey) {
  const parts = adminKey.split("|");
  if (parts.length === 1) {
    return false;
  }
  const [prefix] = parts;
  const prefixParts = prefix.split(":");
  return prefixParts[0] === "preview" && prefixParts.length === 3;
}
function isProjectKey(adminKey) {
  return /^project:.*\|/.test(adminKey);
}
function isDeploymentKey(adminKey) {
  return /^(dev|prod):.*\|/.test(adminKey);
}
function deploymentTypeFromAdminKey(adminKey) {
  const parts = adminKey.split(":");
  if (parts.length === 1) {
    return "prod";
  }
  return parts.at(0);
}
async function getTeamAndProjectFromPreviewAdminKey(ctx, adminKey) {
  const parts = adminKey.split("|")[0].split(":");
  if (parts.length !== 3) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Malformed preview CONVEX_DEPLOY_KEY, get a new key from Project Settings."
    });
  }
  const [_preview, teamSlug, projectSlug] = parts;
  return { teamSlug, projectSlug };
}
//# sourceMappingURL=deployment.js.map
