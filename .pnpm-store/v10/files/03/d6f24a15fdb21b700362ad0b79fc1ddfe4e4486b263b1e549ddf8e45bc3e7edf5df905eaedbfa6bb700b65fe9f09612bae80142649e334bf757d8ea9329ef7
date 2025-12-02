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
var deploymentSelection_exports = {};
__export(deploymentSelection_exports, {
  clearBigBrainAuth: () => clearBigBrainAuth,
  deploymentNameAndTypeFromSelection: () => deploymentNameAndTypeFromSelection,
  deploymentNameFromSelection: () => deploymentNameFromSelection,
  getDeploymentSelection: () => getDeploymentSelection,
  initializeBigBrainAuth: () => initializeBigBrainAuth,
  shouldAllowAnonymousDevelopment: () => shouldAllowAnonymousDevelopment,
  updateBigBrainAuthAfterLogin: () => updateBigBrainAuthAfterLogin
});
module.exports = __toCommonJS(deploymentSelection_exports);
var import_log = require("../../bundler/log.js");
var import_api = require("./api.js");
var import_config = require("./config.js");
var import_deployment = require("./deployment.js");
var import_envvars = require("./envvars.js");
var import_globalConfig = require("./utils/globalConfig.js");
var import_utils = require("./utils/utils.js");
var dotenv = __toESM(require("dotenv"), 1);
async function initializeBigBrainAuth(ctx, initialArgs) {
  if (initialArgs.url !== void 0 && initialArgs.adminKey !== void 0) {
    ctx._updateBigBrainAuth(
      getBigBrainAuth(ctx, {
        previewDeployKey: null,
        projectKey: null,
        deploymentKey: null
      })
    );
    return;
  }
  if (initialArgs.envFile !== void 0) {
    const existingFile = ctx.fs.exists(initialArgs.envFile) ? ctx.fs.readUtf8File(initialArgs.envFile) : null;
    if (existingFile === null) {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: "env file does not exist"
      });
    }
    const config = dotenv.parse(existingFile);
    const rawDeployKey2 = config[import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME];
    const deployKey2 = await (0, import_utils.processDeployKeyValue)(ctx, rawDeployKey2);
    if (deployKey2 !== void 0) {
      const bigBrainAuth = getBigBrainAuth(ctx, {
        previewDeployKey: (0, import_deployment.isPreviewDeployKey)(deployKey2) ? deployKey2 : null,
        projectKey: (0, import_deployment.isProjectKey)(deployKey2) ? deployKey2 : null,
        deploymentKey: (0, import_deployment.isDeploymentKey)(deployKey2) ? deployKey2 : null
      });
      ctx._updateBigBrainAuth(bigBrainAuth);
    }
    return;
  }
  dotenv.config({ path: import_utils.ENV_VAR_FILE_PATH });
  dotenv.config();
  const rawDeployKey = process.env[import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME];
  const deployKey = await (0, import_utils.processDeployKeyValue)(ctx, rawDeployKey);
  if (deployKey !== void 0) {
    const bigBrainAuth = getBigBrainAuth(ctx, {
      previewDeployKey: (0, import_deployment.isPreviewDeployKey)(deployKey) ? deployKey : null,
      projectKey: (0, import_deployment.isProjectKey)(deployKey) ? deployKey : null,
      deploymentKey: (0, import_deployment.isDeploymentKey)(deployKey) ? deployKey : null
    });
    ctx._updateBigBrainAuth(bigBrainAuth);
    return;
  }
  ctx._updateBigBrainAuth(
    getBigBrainAuth(ctx, {
      previewDeployKey: null,
      projectKey: null,
      deploymentKey: null
    })
  );
  return;
}
async function updateBigBrainAuthAfterLogin(ctx, accessToken) {
  const existingAuth = ctx.bigBrainAuth();
  if (existingAuth !== null && existingAuth.kind === "projectKey") {
    (0, import_log.logVerbose)(
      `Ignoring update to big brain auth since project key takes precedence`
    );
    return;
  }
  ctx._updateBigBrainAuth({
    accessToken,
    kind: "accessToken",
    header: `Bearer ${accessToken}`
  });
}
async function clearBigBrainAuth(ctx) {
  ctx._updateBigBrainAuth(null);
}
function getBigBrainAuth(ctx, opts) {
  if (process.env.CONVEX_OVERRIDE_ACCESS_TOKEN) {
    return {
      accessToken: process.env.CONVEX_OVERRIDE_ACCESS_TOKEN,
      kind: "accessToken",
      header: `Bearer ${process.env.CONVEX_OVERRIDE_ACCESS_TOKEN}`
    };
  }
  if (opts.projectKey !== null) {
    return {
      header: `Bearer ${opts.projectKey}`,
      kind: "projectKey",
      projectKey: opts.projectKey
    };
  }
  if (opts.deploymentKey !== null) {
    return {
      header: `Bearer ${opts.deploymentKey}`,
      kind: "deploymentKey",
      deploymentKey: opts.deploymentKey
    };
  }
  const globalConfig = (0, import_globalConfig.readGlobalConfig)(ctx);
  if (globalConfig) {
    return {
      kind: "accessToken",
      header: `Bearer ${globalConfig.accessToken}`,
      accessToken: globalConfig.accessToken
    };
  }
  if (opts.previewDeployKey !== null) {
    return {
      header: `Bearer ${opts.previewDeployKey}`,
      kind: "previewDeployKey",
      previewDeployKey: opts.previewDeployKey
    };
  }
  return null;
}
async function getDeploymentSelection(ctx, cliArgs) {
  const metadata = await _getDeploymentSelection(ctx, cliArgs);
  logDeploymentSelection(ctx, metadata);
  return metadata;
}
function logDeploymentSelection(_ctx, selection) {
  switch (selection.kind) {
    case "existingDeployment": {
      (0, import_log.logVerbose)(
        `Existing deployment: ${selection.deploymentToActOn.url} ${selection.deploymentToActOn.source}`
      );
      break;
    }
    case "deploymentWithinProject": {
      (0, import_log.logVerbose)(
        `Deployment within project: ${prettyProjectSelection(selection.targetProject)}`
      );
      break;
    }
    case "preview": {
      (0, import_log.logVerbose)(`Preview deploy key`);
      break;
    }
    case "chooseProject": {
      (0, import_log.logVerbose)(`Choose project`);
      break;
    }
    case "anonymous": {
      (0, import_log.logVerbose)(
        `Anonymous, has selected deployment?: ${selection.deploymentName !== null}`
      );
      break;
    }
    default: {
      selection;
      (0, import_log.logVerbose)(`Unknown deployment selection`);
    }
  }
  return null;
}
function prettyProjectSelection(selection) {
  switch (selection.kind) {
    case "teamAndProjectSlugs": {
      return `Team and project slugs: ${selection.teamSlug} ${selection.projectSlug}`;
    }
    case "deploymentName": {
      return `Deployment name: ${selection.deploymentName}`;
    }
    case "projectDeployKey": {
      return `Project deploy key`;
    }
    default: {
      selection;
      return `Unknown`;
    }
  }
}
async function _getDeploymentSelection(ctx, cliArgs) {
  if (cliArgs.url !== void 0 && cliArgs.adminKey !== void 0) {
    return {
      kind: "existingDeployment",
      deploymentToActOn: {
        url: cliArgs.url,
        adminKey: cliArgs.adminKey,
        deploymentFields: null,
        source: "cliArgs"
      }
    };
  }
  if (cliArgs.envFile !== void 0) {
    (0, import_log.logVerbose)(`Checking env file: ${cliArgs.envFile}`);
    const existingFile = ctx.fs.exists(cliArgs.envFile) ? ctx.fs.readUtf8File(cliArgs.envFile) : null;
    if (existingFile === null) {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: "env file does not exist"
      });
    }
    const config = dotenv.parse(existingFile);
    const result2 = await getDeploymentSelectionFromEnv(
      ctx,
      (name) => config[name] === void 0 || config[name] === "" ? null : config[name]
    );
    if (result2.kind === "unknown") {
      return ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `env file \`${cliArgs.envFile}\` did not contain environment variables for a Convex deployment. Expected \`${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME}\`, \`${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME}\`, or both \`${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME}\` and \`${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME}\` to be set.`
      });
    }
    return result2.metadata;
  }
  dotenv.config({ path: import_utils.ENV_VAR_FILE_PATH });
  dotenv.config();
  const result = await getDeploymentSelectionFromEnv(ctx, (name) => {
    const value = process.env[name];
    if (value === void 0 || value === "") {
      return null;
    }
    return value;
  });
  if (result.kind !== "unknown") {
    return result.metadata;
  }
  const { projectConfig } = await (0, import_config.readProjectConfig)(ctx);
  if (projectConfig.team !== void 0 && projectConfig.project !== void 0) {
    return {
      kind: "deploymentWithinProject",
      targetProject: {
        kind: "teamAndProjectSlugs",
        teamSlug: projectConfig.team,
        projectSlug: projectConfig.project
      }
    };
  }
  const isLoggedIn = ctx.bigBrainAuth() !== null;
  if (!isLoggedIn && shouldAllowAnonymousDevelopment()) {
    return {
      kind: "anonymous",
      deploymentName: null
    };
  }
  return {
    kind: "chooseProject"
  };
}
async function getDeploymentSelectionFromEnv(ctx, getEnv) {
  const rawDeployKey = getEnv(import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME);
  const deployKey = await (0, import_utils.processDeployKeyValue)(
    ctx,
    rawDeployKey === null ? void 0 : rawDeployKey
  );
  if (deployKey !== void 0) {
    const deployKeyType = (0, import_deployment.isPreviewDeployKey)(deployKey) ? "preview" : (0, import_deployment.isProjectKey)(deployKey) ? "project" : "deployment";
    switch (deployKeyType) {
      case "preview": {
        return {
          kind: "success",
          metadata: {
            kind: "preview",
            previewDeployKey: deployKey
          }
        };
      }
      case "project": {
        return {
          kind: "success",
          metadata: {
            kind: "deploymentWithinProject",
            targetProject: {
              kind: "projectDeployKey",
              projectDeployKey: deployKey
            }
          }
        };
      }
      case "deployment": {
        const deploymentName = await (0, import_deployment.deploymentNameFromAdminKeyOrCrash)(
          ctx,
          deployKey
        );
        const deploymentType = (0, import_deployment.deploymentTypeFromAdminKey)(deployKey);
        const url = await (0, import_utils.bigBrainAPI)({
          ctx,
          method: "POST",
          url: "deployment/url_for_key",
          data: {
            deployKey
          }
        });
        const slugs = await (0, import_api.fetchTeamAndProjectForKey)(ctx, deployKey);
        return {
          kind: "success",
          metadata: {
            kind: "existingDeployment",
            deploymentToActOn: {
              url,
              adminKey: deployKey,
              deploymentFields: {
                deploymentName,
                deploymentType,
                teamSlug: slugs.team,
                projectSlug: slugs.project
              },
              source: "deployKey"
            }
          }
        };
      }
      default: {
        deployKeyType;
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `Unexpected deploy key type: ${deployKeyType}`
        });
      }
    }
  }
  const convexDeployment = getEnv(import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME);
  const selfHostedUrl = getEnv(import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME);
  const selfHostedAdminKey = getEnv(import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME);
  if (selfHostedUrl !== null && selfHostedAdminKey !== null) {
    if (convexDeployment !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} must not be set when ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} are set`
      });
    }
    return {
      kind: "success",
      metadata: {
        kind: "existingDeployment",
        deploymentToActOn: {
          url: selfHostedUrl,
          adminKey: selfHostedAdminKey,
          deploymentFields: null,
          source: "selfHosted"
        }
      }
    };
  }
  if (convexDeployment !== null) {
    if (selfHostedUrl !== null || selfHostedAdminKey !== null) {
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem or env vars",
        printedMessage: `${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} must not be set when ${import_utils.CONVEX_DEPLOYMENT_ENV_VAR_NAME} is set`
      });
    }
    const targetDeploymentType = (0, import_deployment.getDeploymentTypeFromConfiguredDeployment)(convexDeployment);
    const targetDeploymentName = (0, import_deployment.stripDeploymentTypePrefix)(convexDeployment);
    const isAnonymous = (0, import_deployment.isAnonymousDeployment)(targetDeploymentName);
    if (isAnonymous) {
      if (!shouldAllowAnonymousDevelopment()) {
        return {
          kind: "unknown"
        };
      }
      return {
        kind: "success",
        metadata: {
          kind: "anonymous",
          deploymentName: targetDeploymentName
        }
      };
    }
    return {
      kind: "success",
      metadata: {
        kind: "deploymentWithinProject",
        targetProject: {
          kind: "deploymentName",
          deploymentName: targetDeploymentName,
          deploymentType: targetDeploymentType
        }
      }
    };
  }
  await checkIfBuildEnvironmentRequiresDeploymentConfig(ctx);
  return { kind: "unknown" };
}
async function checkIfBuildEnvironmentRequiresDeploymentConfig(ctx) {
  const buildEnvironment = (0, import_envvars.getBuildEnvironment)();
  if (buildEnvironment) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `${buildEnvironment} build environment detected but no Convex deployment configuration found.
Set one of:
  \u2022 ${import_utils.CONVEX_DEPLOY_KEY_ENV_VAR_NAME} for Convex Cloud deployments
  \u2022 ${import_utils.CONVEX_SELF_HOSTED_URL_VAR_NAME} and ${import_utils.CONVEX_SELF_HOSTED_ADMIN_KEY_VAR_NAME} for self-hosted deployments
See https://docs.convex.dev/production/hosting or https://docs.convex.dev/self-hosting`
    });
  }
}
const deploymentNameFromSelection = (selection) => {
  return deploymentNameAndTypeFromSelection(selection)?.name ?? null;
};
const deploymentNameAndTypeFromSelection = (selection) => {
  switch (selection.kind) {
    case "existingDeployment": {
      return {
        name: selection.deploymentToActOn.deploymentFields?.deploymentName ?? null,
        type: selection.deploymentToActOn.deploymentFields?.deploymentType ?? null
      };
    }
    case "deploymentWithinProject": {
      return selection.targetProject.kind === "deploymentName" ? {
        name: selection.targetProject.deploymentName,
        type: selection.targetProject.deploymentType
      } : null;
    }
    case "preview": {
      return null;
    }
    case "chooseProject": {
      return null;
    }
    case "anonymous": {
      return null;
    }
    default: {
      selection;
    }
  }
  return null;
};
const shouldAllowAnonymousDevelopment = () => {
  if (process.env.CONVEX_ALLOW_ANONYMOUS === "false") {
    return false;
  }
  return true;
};
//# sourceMappingURL=deploymentSelection.js.map
