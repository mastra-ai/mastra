"use strict";
import path from "path";
import {
  logFinishedStep,
  logMessage,
  logVerbose,
  logWarning
} from "../../../bundler/log.js";
import { promptSearch, promptString, promptYesNo } from "../utils/prompts.js";
import {
  bigBrainGenerateAdminKeyForAnonymousDeployment,
  bigBrainPause,
  bigBrainStart
} from "./bigBrain.js";
import { LocalDeploymentError, printLocalDeploymentOnError } from "./errors.js";
import {
  deploymentStateDir,
  ensureUuidForAnonymousUser,
  loadDeploymentConfig,
  saveDeploymentConfig
} from "./filePaths.js";
import { rootDeploymentStateDir } from "./filePaths.js";
import { ensureBackendStopped, localDeploymentUrl } from "./run.js";
import { ensureBackendRunning } from "./run.js";
import { handlePotentialUpgrade } from "./upgrade.js";
import {
  isOffline,
  generateInstanceSecret,
  choosePorts,
  LOCAL_BACKEND_INSTANCE_SECRET
} from "./utils.js";
import { handleDashboard } from "./dashboard.js";
import crypto from "crypto";
import { recursivelyDelete, recursivelyCopy } from "../fsUtils.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
import { isAnonymousDeployment } from "../deployment.js";
import { createProject } from "../api.js";
import { removeAnonymousPrefix } from "../deployment.js";
import { nodeFs } from "../../../bundler/fs.js";
import { doCodegenForNewProject } from "../codegen.js";
export async function handleAnonymousDeployment(ctx, options) {
  if (await isOffline()) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Cannot run a local deployment while offline"
    });
  }
  const deployment = await chooseDeployment(ctx, {
    deploymentName: options.deploymentName,
    chosenConfiguration: options.chosenConfiguration
  });
  if (deployment.kind === "first" && process.env.CONVEX_AGENT_MODE !== "anonymous") {
    logMessage(
      "This command, `npx convex dev`, will run your Convex backend locally and update it with the function you write in the `convex/` directory."
    );
    logMessage(
      "Use `npx convex dashboard` to view and interact with your project from a web UI."
    );
    logMessage(
      "Use `npx convex docs` to read the docs and `npx convex help` to see other commands."
    );
    ensureUuidForAnonymousUser(ctx);
    if (process.stdin.isTTY) {
      const result = await promptYesNo(ctx, {
        message: "Continue?",
        default: true
      });
      if (!result) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Exiting"
        });
      }
    }
  }
  ctx.registerCleanup(async (_exitCode, err) => {
    if (err instanceof LocalDeploymentError) {
      printLocalDeploymentOnError();
    }
  });
  const { binaryPath, version } = await ensureBackendBinaryDownloaded(
    ctx,
    options.backendVersion === void 0 ? {
      kind: "latest"
    } : { kind: "version", version: options.backendVersion }
  );
  await handleDashboard(ctx, version);
  let adminKey;
  let instanceSecret;
  if (deployment.kind === "existing") {
    adminKey = deployment.config.adminKey;
    instanceSecret = deployment.config.instanceSecret ?? LOCAL_BACKEND_INSTANCE_SECRET;
    await ensureBackendStopped(ctx, {
      ports: {
        cloud: deployment.config.ports.cloud
      },
      maxTimeSecs: 5,
      deploymentName: deployment.deploymentName,
      allowOtherDeployments: true
    });
  } else {
    instanceSecret = generateInstanceSecret();
    const data = await bigBrainGenerateAdminKeyForAnonymousDeployment(ctx, {
      instanceName: deployment.deploymentName,
      instanceSecret
    });
    adminKey = data.adminKey;
  }
  const [cloudPort, sitePort] = await choosePorts(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null]
  });
  const onActivity = async (isOffline2, _wasOffline) => {
    await ensureBackendRunning(ctx, {
      cloudPort,
      deploymentName: deployment.deploymentName,
      maxTimeSecs: 5
    });
    if (isOffline2) {
      return;
    }
  };
  const { cleanupHandle } = await handlePotentialUpgrade(ctx, {
    deploymentName: deployment.deploymentName,
    deploymentKind: "anonymous",
    oldVersion: deployment.kind === "existing" ? deployment.config.backendVersion : null,
    newBinaryPath: binaryPath,
    newVersion: version,
    ports: { cloud: cloudPort, site: sitePort },
    adminKey,
    instanceSecret,
    forceUpgrade: options.forceUpgrade
  });
  const cleanupFunc = ctx.removeCleanup(cleanupHandle);
  ctx.registerCleanup(async (exitCode, err) => {
    if (cleanupFunc !== null) {
      await cleanupFunc(exitCode, err);
    }
  });
  if (deployment.kind === "new") {
    await doCodegenForNewProject(ctx);
  }
  return {
    adminKey,
    deploymentName: deployment.deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    onActivity
  };
}
export async function loadAnonymousDeployment(ctx, deploymentName) {
  const config = loadDeploymentConfig(ctx, "anonymous", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Could not find deployment with name ${deploymentName}!`
    });
  }
  return config;
}
export async function listExistingAnonymousDeployments(ctx) {
  const dir = rootDeploymentStateDir("anonymous");
  if (!ctx.fs.exists(dir)) {
    return [];
  }
  const deploymentNames = ctx.fs.listDir(dir).map((d) => d.name).filter((d) => isAnonymousDeployment(d));
  return deploymentNames.flatMap((deploymentName) => {
    const config = loadDeploymentConfig(ctx, "anonymous", deploymentName);
    if (config !== null) {
      return [{ deploymentName, config }];
    }
    return [];
  });
}
async function chooseDeployment(ctx, options) {
  const deployments = await listExistingAnonymousDeployments(ctx);
  if (options.deploymentName !== null && options.chosenConfiguration === null) {
    const existing = deployments.find(
      (d) => d.deploymentName === options.deploymentName
    );
    if (existing === void 0) {
      logWarning(`Could not find project with name ${options.deploymentName}!`);
    } else {
      return {
        kind: "existing",
        deploymentName: existing.deploymentName,
        config: existing.config
      };
    }
  }
  if (process.env.CONVEX_AGENT_MODE === "anonymous") {
    const deploymentName = "anonymous-agent";
    const uniqueName = await getUniqueName(
      ctx,
      deploymentName,
      deployments.map((d) => d.deploymentName)
    );
    logVerbose(`Deployment name: ${uniqueName}`);
    return {
      kind: "new",
      deploymentName: uniqueName
    };
  }
  if (deployments.length === 0) {
    logMessage("Let's set up your first project.");
    return await promptForNewDeployment(ctx, []);
  }
  if (options.chosenConfiguration === "new") {
    const deploymentName = await promptString(ctx, {
      message: "Choose a name for your new project:",
      default: path.basename(process.cwd())
    });
    const uniqueName = await getUniqueName(
      ctx,
      deploymentName,
      deployments.map((d) => d.deploymentName)
    );
    logVerbose(`Deployment name: ${uniqueName}`);
    return {
      kind: "new",
      deploymentName: uniqueName
    };
  }
  const newOrExisting = await promptSearch(ctx, {
    message: "Which project would you like to use?",
    choices: [
      ...options.chosenConfiguration === "existing" ? [] : [
        {
          name: "Create a new one",
          value: "new"
        }
      ],
      ...deployments.map((d) => ({
        name: d.deploymentName,
        value: d.deploymentName
      }))
    ]
  });
  if (newOrExisting !== "new") {
    const existingDeployment = deployments.find(
      (d) => d.deploymentName === newOrExisting
    );
    if (existingDeployment === void 0) {
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Could not find project with name ${newOrExisting}!`
      });
    }
    return {
      kind: "existing",
      deploymentName: existingDeployment.deploymentName,
      config: existingDeployment.config
    };
  }
  return await promptForNewDeployment(
    ctx,
    deployments.map((d) => d.deploymentName)
  );
}
async function promptForNewDeployment(ctx, existingNames) {
  const isFirstDeployment = existingNames.length === 0;
  const deploymentName = await promptString(ctx, {
    message: "Choose a name:",
    default: path.basename(process.cwd())
  });
  const uniqueName = await getUniqueName(
    ctx,
    `anonymous-${deploymentName}`,
    existingNames
  );
  logVerbose(`Deployment name: ${uniqueName}`);
  return isFirstDeployment ? {
    kind: "first",
    deploymentName: uniqueName
  } : {
    kind: "new",
    deploymentName: uniqueName
  };
}
async function getUniqueName(ctx, name, existingNames) {
  if (!existingNames.includes(name)) {
    return name;
  }
  for (let i = 1; i <= 5; i++) {
    const uniqueName2 = `${name}-${i}`;
    if (!existingNames.includes(uniqueName2)) {
      return uniqueName2;
    }
  }
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const uniqueName = `${name}-${randomSuffix}`;
  if (!existingNames.includes(uniqueName)) {
    return uniqueName;
  }
  return ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `Could not generate a unique name for your project, please choose a different name`
  });
}
export async function handleLinkToProject(ctx, args) {
  logVerbose(
    `Linking ${args.deploymentName} to a project in team ${args.teamSlug}`
  );
  const config = loadDeploymentConfig(ctx, "anonymous", args.deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config"
    });
  }
  await ensureBackendStopped(ctx, {
    ports: {
      cloud: config.ports.cloud
    },
    deploymentName: args.deploymentName,
    allowOtherDeployments: true,
    maxTimeSecs: 5
  });
  const projectName = removeAnonymousPrefix(args.deploymentName);
  let projectSlug;
  if (args.projectSlug !== null) {
    projectSlug = args.projectSlug;
  } else {
    const { projectSlug: newProjectSlug } = await createProject(ctx, {
      teamSlug: args.teamSlug,
      projectName,
      deploymentTypeToProvision: "prod"
    });
    projectSlug = newProjectSlug;
  }
  logVerbose(`Creating local deployment in project ${projectSlug}`);
  const { deploymentName: localDeploymentName, adminKey } = await bigBrainStart(
    ctx,
    {
      port: config.ports.cloud,
      projectSlug,
      teamSlug: args.teamSlug,
      instanceName: null
    }
  );
  const localConfig = loadDeploymentConfig(ctx, "local", localDeploymentName);
  if (localConfig !== null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Project ${projectSlug} already has a local deployment, so we cannot link this anonymous local deployment to it.`
    });
  }
  logVerbose(`Moving ${args.deploymentName} to ${localDeploymentName}`);
  await moveDeployment(
    ctx,
    {
      deploymentKind: "anonymous",
      deploymentName: args.deploymentName
    },
    {
      deploymentKind: "local",
      deploymentName: localDeploymentName
    }
  );
  logVerbose(`Saving deployment config for ${localDeploymentName}`);
  saveDeploymentConfig(ctx, "local", localDeploymentName, {
    adminKey,
    backendVersion: config.backendVersion,
    ports: config.ports
  });
  await bigBrainPause(ctx, {
    projectSlug,
    teamSlug: args.teamSlug
  });
  logFinishedStep(`Linked ${args.deploymentName} to project ${projectSlug}`);
  return {
    projectSlug,
    deploymentName: localDeploymentName,
    deploymentUrl: localDeploymentUrl(config.ports.cloud)
  };
}
export async function moveDeployment(ctx, oldDeployment, newDeployment) {
  const oldPath = deploymentStateDir(
    oldDeployment.deploymentKind,
    oldDeployment.deploymentName
  );
  const newPath = deploymentStateDir(
    newDeployment.deploymentKind,
    newDeployment.deploymentName
  );
  await recursivelyCopy(ctx, nodeFs, oldPath, newPath);
  recursivelyDelete(ctx, oldPath);
}
//# sourceMappingURL=anonymous.js.map
