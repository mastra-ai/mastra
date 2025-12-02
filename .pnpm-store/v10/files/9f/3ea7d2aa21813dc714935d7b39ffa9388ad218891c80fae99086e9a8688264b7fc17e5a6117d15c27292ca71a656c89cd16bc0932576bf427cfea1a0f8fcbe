"use strict";
import chalk from "chalk";
import {
  logFailure,
  logFinishedStep,
  logMessage,
  logOutput
} from "../../bundler/log.js";
import { runSystemQuery } from "./run.js";
import { deploymentFetch, logAndHandleFetchError } from "./utils/utils.js";
import { readFromStdin } from "./utils/stdin.js";
export async function envSetInDeployment(ctx, deployment, rawName, rawValue, options) {
  const [name, value] = await allowEqualsSyntax(ctx, rawName, rawValue);
  await callUpdateEnvironmentVariables(ctx, deployment, [{ name, value }]);
  const formatted = /\s/.test(value) ? `"${value}"` : value;
  if (options?.secret) {
    logFinishedStep(
      `Successfully set ${chalk.bold(name)} to ${chalk.bold(formatted)}${deployment.deploymentNotice}`
    );
  } else {
    logFinishedStep(`Successfully set ${chalk.bold(name)}`);
  }
}
async function allowEqualsSyntax(ctx, name, value) {
  if (value === void 0) {
    if (/^[a-zA-Z][a-zA-Z0-9_]+=/.test(name)) {
      return name.split("=", 2);
    } else if (!process.stdin.isTTY) {
      try {
        const stdinValue = await readFromStdin();
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
export async function envGetInDeploymentAction(ctx, deployment, name) {
  const envVar = await envGetInDeployment(ctx, deployment, name);
  if (envVar === null) {
    logFailure(`Environment variable "${name}" not found.`);
    return;
  }
  logOutput(`${envVar}`);
}
export async function envGetInDeployment(ctx, deployment, name) {
  const envVar = await runSystemQuery(ctx, {
    ...deployment,
    functionName: "_system/cli/queryEnvironmentVariables:get",
    componentPath: void 0,
    args: { name }
  });
  return envVar === null ? null : envVar.value;
}
export async function envRemoveInDeployment(ctx, deployment, name) {
  await callUpdateEnvironmentVariables(ctx, deployment, [{ name }]);
  logFinishedStep(
    `Successfully unset ${chalk.bold(name)}${deployment.deploymentNotice}`
  );
}
export async function envListInDeployment(ctx, deployment) {
  const envs = await runSystemQuery(ctx, {
    ...deployment,
    functionName: "_system/cli/queryEnvironmentVariables",
    componentPath: void 0,
    args: {}
  });
  if (envs.length === 0) {
    logMessage("No environment variables set.");
    return;
  }
  for (const { name, value } of envs) {
    logOutput(`${name}=${value}`);
  }
}
export async function callUpdateEnvironmentVariables(ctx, deployment, changes) {
  const fetch = deploymentFetch(ctx, deployment);
  try {
    await fetch("/api/update_environment_variables", {
      body: JSON.stringify({ changes }),
      method: "POST"
    });
  } catch (e) {
    return await logAndHandleFetchError(ctx, e);
  }
}
//# sourceMappingURL=env.js.map
