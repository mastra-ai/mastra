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
var env_exports = {};
__export(env_exports, {
  callUpdateEnvironmentVariables: () => callUpdateEnvironmentVariables,
  envGetInDeployment: () => envGetInDeployment,
  envGetInDeploymentAction: () => envGetInDeploymentAction,
  envListInDeployment: () => envListInDeployment,
  envRemoveInDeployment: () => envRemoveInDeployment,
  envSetInDeployment: () => envSetInDeployment
});
module.exports = __toCommonJS(env_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_run = require("./run.js");
var import_utils = require("./utils/utils.js");
var import_stdin = require("./utils/stdin.js");
async function envSetInDeployment(ctx, deployment, rawName, rawValue, options) {
  const [name, value] = await allowEqualsSyntax(ctx, rawName, rawValue);
  await callUpdateEnvironmentVariables(ctx, deployment, [{ name, value }]);
  const formatted = /\s/.test(value) ? `"${value}"` : value;
  if (options?.secret) {
    (0, import_log.logFinishedStep)(
      `Successfully set ${import_chalk.default.bold(name)} to ${import_chalk.default.bold(formatted)}${deployment.deploymentNotice}`
    );
  } else {
    (0, import_log.logFinishedStep)(`Successfully set ${import_chalk.default.bold(name)}`);
  }
}
async function allowEqualsSyntax(ctx, name, value) {
  if (value === void 0) {
    if (/^[a-zA-Z][a-zA-Z0-9_]+=/.test(name)) {
      return name.split("=", 2);
    } else if (!process.stdin.isTTY) {
      try {
        const stdinValue = await (0, import_stdin.readFromStdin)();
        return [name, stdinValue];
      } catch (error) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `error: failed to read from stdin: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "error: missing required argument 'value'"
      });
    }
  }
  return [name, value];
}
async function envGetInDeploymentAction(ctx, deployment, name) {
  const envVar = await envGetInDeployment(ctx, deployment, name);
  if (envVar === null) {
    (0, import_log.logFailure)(`Environment variable "${name}" not found.`);
    return;
  }
  (0, import_log.logOutput)(`${envVar}`);
}
async function envGetInDeployment(ctx, deployment, name) {
  const envVar = await (0, import_run.runSystemQuery)(ctx, {
    ...deployment,
    functionName: "_system/cli/queryEnvironmentVariables:get",
    componentPath: void 0,
    args: { name }
  });
  return envVar === null ? null : envVar.value;
}
async function envRemoveInDeployment(ctx, deployment, name) {
  await callUpdateEnvironmentVariables(ctx, deployment, [{ name }]);
  (0, import_log.logFinishedStep)(
    `Successfully unset ${import_chalk.default.bold(name)}${deployment.deploymentNotice}`
  );
}
async function envListInDeployment(ctx, deployment) {
  const envs = await (0, import_run.runSystemQuery)(ctx, {
    ...deployment,
    functionName: "_system/cli/queryEnvironmentVariables",
    componentPath: void 0,
    args: {}
  });
  if (envs.length === 0) {
    (0, import_log.logMessage)("No environment variables set.");
    return;
  }
  for (const { name, value } of envs) {
    (0, import_log.logOutput)(`${name}=${value}`);
  }
}
async function callUpdateEnvironmentVariables(ctx, deployment, changes) {
  const fetch = (0, import_utils.deploymentFetch)(ctx, deployment);
  try {
    await fetch("/api/update_environment_variables", {
      body: JSON.stringify({ changes }),
      method: "POST"
    });
  } catch (e) {
    return await (0, import_utils.logAndHandleFetchError)(ctx, e);
  }
}
//# sourceMappingURL=env.js.map
