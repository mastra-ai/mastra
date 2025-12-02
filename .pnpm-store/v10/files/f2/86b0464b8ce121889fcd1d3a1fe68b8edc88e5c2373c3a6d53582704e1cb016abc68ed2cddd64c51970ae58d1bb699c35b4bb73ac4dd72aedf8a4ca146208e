"use strict";
import * as dotenv from "dotenv";
import { changedEnvVarFile, getEnvVarRegex } from "./envvars.js";
import {
  CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  ENV_VAR_FILE_PATH
} from "./utils/utils.js";
export function stripDeploymentTypePrefix(deployment) {
  return deployment.split(":").at(-1);
}
export function getDeploymentTypeFromConfiguredDeployment(raw) {
  const typeRaw = raw.split(":")[0];
  const type = typeRaw === "prod" || typeRaw === "dev" || typeRaw === "preview" || typeRaw === "local" ? typeRaw : null;
  return type;
}
export function isAnonymousDeployment(deploymentName) {
  return deploymentName.startsWith("anonymous-");
}
export function removeAnonymousPrefix(deploymentName) {
  if (isAnonymousDeployment(deploymentName)) {
    return deploymentName.slice("anonymous-".length);
  }
  return deploymentName;
}
export async function writeDeploymentEnvVar(ctx, deploymentType, deployment, existingValue) {
  const existingFile = ctx.fs.exists(ENV_VAR_FILE_PATH) ? ctx.fs.readUtf8File(ENV_VAR_FILE_PATH) : null;
  const changedFile = changesToEnvVarFile(
    existingFile,
    deploymentType,
    deployment
  );
  const deploymentEnvVarValue = deploymentType + ":" + deployment.deploymentName;
  const changedDeploymentEnvVar = existingValue !== deployment.deploymentName && existingValue !== deploymentEnvVarValue;
  if (changedFile !== null) {
    ctx.fs.writeUtf8File(ENV_VAR_FILE_PATH, changedFile);
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
export async function eraseDeploymentEnvVar(ctx) {
  const existingFile = ctx.fs.exists(ENV_VAR_FILE_PATH) ? ctx.fs.readUtf8File(ENV_VAR_FILE_PATH) : null;
  if (existingFile === null) {
    return false;
  }
  const config = dotenv.parse(existingFile);
  const existing = config[CONVEX_DEPLOYMENT_ENV_VAR_NAME];
  if (existing === void 0) {
    return false;
  }
  const changedFile = existingFile.replace(
    getEnvVarRegex(CONVEX_DEPLOYMENT_ENV_VAR_NAME),
    ""
  );
  ctx.fs.writeUtf8File(ENV_VAR_FILE_PATH, changedFile);
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
export function changesToEnvVarFile(existingFile, deploymentType, {
  team,
  project,
  deploymentName
}) {
  const deploymentValue = deploymentType + ":" + deploymentName;
  const commentOnPreviousLine = "# Deployment used by `npx convex dev`";
  const commentAfterValue = team !== null && project !== null ? `team: ${team}, project: ${project}` : null;
  return changedEnvVarFile({
    existingFileContent: existingFile,
    envVarName: CONVEX_DEPLOYMENT_ENV_VAR_NAME,
    envVarValue: deploymentValue,
    commentAfterValue,
    commentOnPreviousLine
  });
}
export function changesToGitIgnore(existingFile) {
  if (existingFile === null) {
    return `${ENV_VAR_FILE_PATH}
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
${ENV_VAR_FILE_PATH}
`;
  } else {
    return null;
  }
}
export async function deploymentNameFromAdminKeyOrCrash(ctx, adminKey) {
  const deploymentName = deploymentNameFromAdminKey(adminKey);
  if (deploymentName === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Please set ${CONVEX_DEPLOY_KEY_ENV_VAR_NAME} to a new key which you can find on your Convex dashboard.`
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
export function isPreviewDeployKey(adminKey) {
  const parts = adminKey.split("|");
  if (parts.length === 1) {
    return false;
  }
  const [prefix] = parts;
  const prefixParts = prefix.split(":");
  return prefixParts[0] === "preview" && prefixParts.length === 3;
}
export function isProjectKey(adminKey) {
  return /^project:.*\|/.test(adminKey);
}
export function isDeploymentKey(adminKey) {
  return /^(dev|prod):.*\|/.test(adminKey);
}
export function deploymentTypeFromAdminKey(adminKey) {
  const parts = adminKey.split(":");
  if (parts.length === 1) {
    return "prod";
  }
  return parts.at(0);
}
export async function getTeamAndProjectFromPreviewAdminKey(ctx, adminKey) {
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
