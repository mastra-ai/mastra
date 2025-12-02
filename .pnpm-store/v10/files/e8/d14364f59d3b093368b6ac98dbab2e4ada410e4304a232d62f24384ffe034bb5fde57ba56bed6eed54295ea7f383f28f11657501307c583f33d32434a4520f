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
var init_exports = {};
__export(init_exports, {
  finalizeConfiguration: () => finalizeConfiguration
});
module.exports = __toCommonJS(init_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_envvars = require("./envvars.js");
var import_dashboard = require("./dashboard.js");
async function finalizeConfiguration(ctx, options) {
  const envVarWrite = await (0, import_envvars.writeConvexUrlToEnvFile)(ctx, options.url);
  if (envVarWrite !== null) {
    (0, import_log.logFinishedStep)(
      `${messageForDeploymentType(options.deploymentType, options.url)} and saved its:
    name as CONVEX_DEPLOYMENT to .env.local
    URL as ${envVarWrite.envVar} to ${envVarWrite.envFile}`
    );
  } else if (options.changedDeploymentEnvVar) {
    (0, import_log.logFinishedStep)(
      `${messageForDeploymentType(options.deploymentType, options.url)} and saved its name as CONVEX_DEPLOYMENT to .env.local`
    );
  }
  if (options.wroteToGitIgnore) {
    (0, import_log.logMessage)(import_chalk.default.gray(`  Added ".env.local" to .gitignore`));
  }
  if (options.deploymentType === "anonymous") {
    (0, import_log.logMessage)(
      `Run \`npx convex login\` at any time to create an account and link this deployment.`
    );
  }
  const anyChanges = options.wroteToGitIgnore || options.changedDeploymentEnvVar || envVarWrite !== null;
  if (anyChanges) {
    const dashboardUrl = (0, import_dashboard.getDashboardUrl)(ctx, {
      deploymentName: options.deploymentName,
      deploymentType: options.deploymentType
    });
    (0, import_log.logMessage)(
      `
Write your Convex functions in ${import_chalk.default.bold(options.functionsPath)}
Give us feedback at https://convex.dev/community or support@convex.dev
View the Convex dashboard at ${dashboardUrl}
`
    );
  }
}
function messageForDeploymentType(deploymentType, url) {
  switch (deploymentType) {
    case "anonymous":
      return `Started running a deployment locally at ${url}`;
    case "local":
      return `Started running a deployment locally at ${url}`;
    case "dev":
    case "prod":
    case "preview":
      return `Provisioned a ${deploymentType} deployment`;
    default: {
      deploymentType;
      return `Provisioned a ${deploymentType} deployment`;
    }
  }
}
//# sourceMappingURL=init.js.map
