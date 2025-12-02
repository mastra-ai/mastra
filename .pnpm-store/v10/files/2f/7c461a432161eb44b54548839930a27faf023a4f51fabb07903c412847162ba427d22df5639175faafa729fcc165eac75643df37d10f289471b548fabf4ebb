import chalk from "chalk";
import { Context } from "../../bundler/context.js";
import { logFinishedStep, logMessage } from "../../bundler/log.js";
import { DeploymentType } from "./api.js";
import { writeConvexUrlToEnvFile } from "./envvars.js";
import { getDashboardUrl } from "./dashboard.js";

export async function finalizeConfiguration(
  ctx: Context,
  options: {
    functionsPath: string;
    deploymentType: DeploymentType;
    deploymentName: string;
    url: string;
    wroteToGitIgnore: boolean;
    changedDeploymentEnvVar: boolean;
  },
) {
  const envVarWrite = await writeConvexUrlToEnvFile(ctx, options.url);
  if (envVarWrite !== null) {
    logFinishedStep(
      `${messageForDeploymentType(options.deploymentType, options.url)} and saved its:\n` +
        `    name as CONVEX_DEPLOYMENT to .env.local\n` +
        `    URL as ${envVarWrite.envVar} to ${envVarWrite.envFile}`,
    );
  } else if (options.changedDeploymentEnvVar) {
    logFinishedStep(
      `${messageForDeploymentType(options.deploymentType, options.url)} and saved its name as CONVEX_DEPLOYMENT to .env.local`,
    );
  }
  if (options.wroteToGitIgnore) {
    logMessage(chalk.gray(`  Added ".env.local" to .gitignore`));
  }
  if (options.deploymentType === "anonymous") {
    logMessage(
      `Run \`npx convex login\` at any time to create an account and link this deployment.`,
    );
  }

  const anyChanges =
    options.wroteToGitIgnore ||
    options.changedDeploymentEnvVar ||
    envVarWrite !== null;
  if (anyChanges) {
    const dashboardUrl = getDashboardUrl(ctx, {
      deploymentName: options.deploymentName,
      deploymentType: options.deploymentType,
    });
    logMessage(
      `\nWrite your Convex functions in ${chalk.bold(options.functionsPath)}\n` +
        "Give us feedback at https://convex.dev/community or support@convex.dev\n" +
        `View the Convex dashboard at ${dashboardUrl}\n`,
    );
  }
}

function messageForDeploymentType(deploymentType: DeploymentType, url: string) {
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
      deploymentType satisfies never;
      return `Provisioned a ${deploymentType as any} deployment`;
    }
  }
}
