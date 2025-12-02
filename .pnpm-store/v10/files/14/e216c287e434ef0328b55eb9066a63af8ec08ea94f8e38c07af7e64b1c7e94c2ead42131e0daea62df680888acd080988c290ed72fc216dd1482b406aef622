import * as dotenv from "dotenv";
import { Context } from "../../bundler/context.js";
import { changedEnvVarFile, getEnvVarRegex } from "./envvars.js";
import {
  CONVEX_DEPLOY_KEY_ENV_VAR_NAME,
  CONVEX_DEPLOYMENT_ENV_VAR_NAME,
  ENV_VAR_FILE_PATH,
} from "./utils/utils.js";
import { DeploymentType } from "./api.js";

// Given a deployment string like "dev:tall-forest-1234"
// returns only the slug "tall-forest-1234".
// If there's no prefix returns the original string.
export function stripDeploymentTypePrefix(deployment: string) {
  return deployment.split(":").at(-1)!;
}

// Handling legacy CONVEX_DEPLOYMENT without type prefix as well
export function getDeploymentTypeFromConfiguredDeployment(raw: string) {
  const typeRaw = raw.split(":")[0];
  const type =
    typeRaw === "prod" ||
    typeRaw === "dev" ||
    typeRaw === "preview" ||
    typeRaw === "local"
      ? typeRaw
      : null;
  return type;
}

export function isAnonymousDeployment(deploymentName: string) {
  return deploymentName.startsWith("anonymous-");
}

export function removeAnonymousPrefix(deploymentName: string) {
  if (isAnonymousDeployment(deploymentName)) {
    return deploymentName.slice("anonymous-".length);
  }
  return deploymentName;
}

export async function writeDeploymentEnvVar(
  ctx: Context,
  deploymentType: DeploymentType,
  deployment: {
    team: string | null;
    project: string | null;
    deploymentName: string;
  },
  existingValue: string | null,
): Promise<{ wroteToGitIgnore: boolean; changedDeploymentEnvVar: boolean }> {
  const existingFile = ctx.fs.exists(ENV_VAR_FILE_PATH)
    ? ctx.fs.readUtf8File(ENV_VAR_FILE_PATH)
    : null;
  const changedFile = changesToEnvVarFile(
    existingFile,
    deploymentType,
    deployment,
  );
  const deploymentEnvVarValue =
    deploymentType + ":" + deployment.deploymentName;
  // The `existingValue` that reaches this function is at least sometimes is missing its prefix.
  // Until this is cleaned up consider either of these values not a change.
  // Otherwise we spam the init instructions (Welcome to Convex etc.) on every run of `npx convex dev`.
  const changedDeploymentEnvVar =
    existingValue !== deployment.deploymentName &&
    existingValue !== deploymentEnvVarValue;

  if (changedFile !== null) {
    ctx.fs.writeUtf8File(ENV_VAR_FILE_PATH, changedFile);
    // Only do this if we're not reinitializing an existing setup
    return {
      wroteToGitIgnore: await gitIgnoreEnvVarFile(ctx),
      changedDeploymentEnvVar,
    };
  }
  return {
    wroteToGitIgnore: false,
    changedDeploymentEnvVar,
  };
}

// Only used in the internal --url flow
export async function eraseDeploymentEnvVar(ctx: Context): Promise<boolean> {
  const existingFile = ctx.fs.exists(ENV_VAR_FILE_PATH)
    ? ctx.fs.readUtf8File(ENV_VAR_FILE_PATH)
    : null;
  if (existingFile === null) {
    return false;
  }
  const config = dotenv.parse(existingFile);
  const existing = config[CONVEX_DEPLOYMENT_ENV_VAR_NAME];
  if (existing === undefined) {
    return false;
  }
  const changedFile = existingFile.replace(
    getEnvVarRegex(CONVEX_DEPLOYMENT_ENV_VAR_NAME),
    "",
  );
  ctx.fs.writeUtf8File(ENV_VAR_FILE_PATH, changedFile);
  return true;
}

async function gitIgnoreEnvVarFile(ctx: Context): Promise<boolean> {
  const gitIgnorePath = ".gitignore";
  const gitIgnoreContents = ctx.fs.exists(gitIgnorePath)
    ? ctx.fs.readUtf8File(gitIgnorePath)
    : "";
  const changedGitIgnore = changesToGitIgnore(gitIgnoreContents);
  if (changedGitIgnore !== null) {
    ctx.fs.writeUtf8File(gitIgnorePath, changedGitIgnore);
    return true;
  }
  return false;
}

// exported for tests
export function changesToEnvVarFile(
  existingFile: string | null,
  deploymentType: DeploymentType,
  {
    team,
    project,
    deploymentName,
  }: { team: string | null; project: string | null; deploymentName: string },
): string | null {
  const deploymentValue = deploymentType + ":" + deploymentName;
  const commentOnPreviousLine = "# Deployment used by `npx convex dev`";
  const commentAfterValue =
    team !== null && project !== null
      ? `team: ${team}, project: ${project}`
      : null;
  return changedEnvVarFile({
    existingFileContent: existingFile,
    envVarName: CONVEX_DEPLOYMENT_ENV_VAR_NAME,
    envVarValue: deploymentValue,
    commentAfterValue,
    commentOnPreviousLine,
  });
}

// exported for tests
export function changesToGitIgnore(existingFile: string | null): string | null {
  if (existingFile === null) {
    return `${ENV_VAR_FILE_PATH}\n`;
  }
  const gitIgnoreLines = existingFile.split("\n");
  const envVarFileIgnored = gitIgnoreLines.some((line) => {
    if (line.startsWith("#")) return false;
    if (line.startsWith("!")) return false;

    // .gitignore ignores trailing whitespace, and also we need to remove
    // the trailing `\r` from Windows-style newline since we split on `\n`.
    const trimmedLine = line.trimEnd();

    const envIgnorePatterns = [
      /^\.env\.local$/,
      /^\.env\.\*$/,
      /^\.env\*$/,
      /^.*\.local$/,
      /^\.env\*\.local$/,
    ];

    return envIgnorePatterns.some((pattern) => pattern.test(trimmedLine));
  });
  if (!envVarFileIgnored) {
    return `${existingFile}\n${ENV_VAR_FILE_PATH}\n`;
  } else {
    return null;
  }
}

export async function deploymentNameFromAdminKeyOrCrash(
  ctx: Context,
  adminKey: string,
) {
  const deploymentName = deploymentNameFromAdminKey(adminKey);
  if (deploymentName === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Please set ${CONVEX_DEPLOY_KEY_ENV_VAR_NAME} to a new key which you can find on your Convex dashboard.`,
    });
  }
  return deploymentName;
}

function deploymentNameFromAdminKey(adminKey: string) {
  const parts = adminKey.split("|");
  if (parts.length === 1) {
    return null;
  }
  if (isPreviewDeployKey(adminKey)) {
    // Preview deploy keys do not contain a deployment name.
    return null;
  }
  return stripDeploymentTypePrefix(parts[0]);
}

// Needed to differentiate a preview deploy key
// from a concrete preview deployment's deploy key.
// preview deploy key: `preview:team:project|key`
// preview deployment's deploy key: `preview:deploymentName|key`
export function isPreviewDeployKey(adminKey: string) {
  const parts = adminKey.split("|");
  if (parts.length === 1) {
    return false;
  }
  const [prefix] = parts;
  const prefixParts = prefix.split(":");
  return prefixParts[0] === "preview" && prefixParts.length === 3;
}

export function isProjectKey(adminKey: string) {
  return /^project:.*\|/.test(adminKey);
}

// "dev deploy keys" and "prod deploy keys" are deployment keys.
// On the client these are also known as admin keys.
export function isDeploymentKey(adminKey: string) {
  return /^(dev|prod):.*\|/.test(adminKey);
}

// For current keys returns prod|dev|preview,
// for legacy keys returns "prod".
// Examples:
//  "prod:deploymentName|key" -> "prod"
//  "preview:deploymentName|key" -> "preview"
//  "dev:deploymentName|key" -> "dev"
//  "key" -> "prod"
export function deploymentTypeFromAdminKey(adminKey: string) {
  const parts = adminKey.split(":");
  if (parts.length === 1) {
    return "prod";
  }
  return parts.at(0)! as DeploymentType;
}

export async function getTeamAndProjectFromPreviewAdminKey(
  ctx: Context,
  adminKey: string,
) {
  const parts = adminKey.split("|")[0].split(":");
  if (parts.length !== 3) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage:
        "Malformed preview CONVEX_DEPLOY_KEY, get a new key from Project Settings.",
    });
  }
  const [_preview, teamSlug, projectSlug] = parts;
  return { teamSlug, projectSlug };
}

export type OnDeploymentActivityFunc = (
  isOffline: boolean,
  wasOffline: boolean,
) => Promise<void>;
export type CleanupDeploymentFunc = () => Promise<void>;
export type DeploymentDetails = {
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
  onActivity: OnDeploymentActivityFunc | null;
};
