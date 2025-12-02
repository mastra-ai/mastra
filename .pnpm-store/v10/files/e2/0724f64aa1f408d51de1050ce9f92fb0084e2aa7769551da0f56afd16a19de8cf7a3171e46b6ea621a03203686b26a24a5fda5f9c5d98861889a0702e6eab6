"use strict";
import { logVerbose } from "../../../bundler/log.js";
import {
  bigBrainPause,
  bigBrainRecordActivity,
  bigBrainStart
} from "./bigBrain.js";
import {
  loadDeploymentConfig,
  rootDeploymentStateDir,
  saveDeploymentConfig
} from "./filePaths.js";
import {
  ensureBackendRunning,
  ensureBackendStopped,
  localDeploymentUrl,
  runLocalBackend
} from "./run.js";
import { handlePotentialUpgrade } from "./upgrade.js";
import { promptSearch } from "../utils/prompts.js";
import { LocalDeploymentError, printLocalDeploymentOnError } from "./errors.js";
import {
  choosePorts,
  printLocalDeploymentWelcomeMessage,
  isOffline,
  LOCAL_BACKEND_INSTANCE_SECRET
} from "./utils.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
export async function handleLocalDeployment(ctx, options) {
  if (await isOffline()) {
    return handleOffline(ctx, options);
  }
  const existingDeploymentForProject = await getExistingDeployment(ctx, {
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug
  });
  if (existingDeploymentForProject === null) {
    printLocalDeploymentWelcomeMessage();
  }
  ctx.registerCleanup(async (_exitCode, err) => {
    if (err instanceof LocalDeploymentError) {
      printLocalDeploymentOnError();
    }
  });
  if (existingDeploymentForProject !== null) {
    logVerbose(`Found existing deployment for project ${options.projectSlug}`);
    await ensureBackendStopped(ctx, {
      ports: {
        cloud: existingDeploymentForProject.config.ports.cloud
      },
      maxTimeSecs: 5,
      deploymentName: existingDeploymentForProject.deploymentName,
      allowOtherDeployments: true
    });
  }
  const { binaryPath, version } = await ensureBackendBinaryDownloaded(
    ctx,
    options.backendVersion === void 0 ? {
      kind: "latest",
      allowedVersion: existingDeploymentForProject?.config.backendVersion
    } : { kind: "version", version: options.backendVersion }
  );
  const [cloudPort, sitePort] = await choosePorts(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null]
  });
  const { deploymentName, adminKey } = await bigBrainStart(ctx, {
    port: cloudPort,
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug,
    instanceName: existingDeploymentForProject?.deploymentName ?? null
  });
  const onActivity = async (isOffline2, _wasOffline) => {
    await ensureBackendRunning(ctx, {
      cloudPort,
      deploymentName,
      maxTimeSecs: 5
    });
    if (isOffline2) {
      return;
    }
    await bigBrainRecordActivity(ctx, {
      instanceName: deploymentName
    });
  };
  const { cleanupHandle } = await handlePotentialUpgrade(ctx, {
    deploymentKind: "local",
    deploymentName,
    oldVersion: existingDeploymentForProject?.config.backendVersion ?? null,
    newBinaryPath: binaryPath,
    newVersion: version,
    ports: { cloud: cloudPort, site: sitePort },
    adminKey,
    instanceSecret: LOCAL_BACKEND_INSTANCE_SECRET,
    forceUpgrade: options.forceUpgrade
  });
  const cleanupFunc = ctx.removeCleanup(cleanupHandle);
  ctx.registerCleanup(async (exitCode, err) => {
    if (cleanupFunc !== null) {
      await cleanupFunc(exitCode, err);
    }
    await bigBrainPause(ctx, {
      projectSlug: options.projectSlug,
      teamSlug: options.teamSlug
    });
  });
  return {
    adminKey,
    deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    onActivity
  };
}
export async function loadLocalDeploymentCredentials(ctx, deploymentName) {
  const config = loadDeploymentConfig(ctx, "local", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config"
    });
  }
  return {
    deploymentName,
    deploymentUrl: localDeploymentUrl(config.ports.cloud),
    adminKey: config.adminKey
  };
}
async function handleOffline(ctx, options) {
  const { deploymentName, config } = await chooseFromExistingLocalDeployments(ctx);
  const { binaryPath } = await ensureBackendBinaryDownloaded(ctx, {
    kind: "version",
    version: config.backendVersion
  });
  const [cloudPort, sitePort] = await choosePorts(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null]
  });
  saveDeploymentConfig(ctx, "local", deploymentName, config);
  await runLocalBackend(ctx, {
    binaryPath,
    ports: { cloud: cloudPort, site: sitePort },
    deploymentName,
    deploymentKind: "local",
    instanceSecret: LOCAL_BACKEND_INSTANCE_SECRET,
    isLatestVersion: false
  });
  return {
    adminKey: config.adminKey,
    deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    onActivity: async (isOffline2, wasOffline) => {
      await ensureBackendRunning(ctx, {
        cloudPort,
        deploymentName,
        maxTimeSecs: 5
      });
      if (isOffline2) {
        return;
      }
      if (wasOffline) {
        await bigBrainStart(ctx, {
          port: cloudPort,
          projectSlug: options.projectSlug,
          teamSlug: options.teamSlug,
          instanceName: deploymentName
        });
      }
      await bigBrainRecordActivity(ctx, {
        instanceName: deploymentName
      });
    }
  };
}
async function getExistingDeployment(ctx, options) {
  const { projectSlug, teamSlug } = options;
  const prefix = `local-${teamSlug.replace(/-/g, "_")}-${projectSlug.replace(/-/g, "_")}`;
  const localDeployments = await getLocalDeployments(ctx);
  const existingDeploymentForProject = localDeployments.find(
    (d) => d.deploymentName.startsWith(prefix)
  );
  if (existingDeploymentForProject === void 0) {
    return null;
  }
  return {
    deploymentName: existingDeploymentForProject.deploymentName,
    config: existingDeploymentForProject.config
  };
}
async function getLocalDeployments(ctx) {
  const dir = rootDeploymentStateDir("local");
  if (!ctx.fs.exists(dir)) {
    return [];
  }
  const deploymentNames = ctx.fs.listDir(dir).map((d) => d.name).filter((d) => d.startsWith("local-"));
  return deploymentNames.flatMap((deploymentName) => {
    const config = loadDeploymentConfig(ctx, "local", deploymentName);
    if (config !== null) {
      return [{ deploymentName, config }];
    }
    return [];
  });
}
async function chooseFromExistingLocalDeployments(ctx) {
  const localDeployments = await getLocalDeployments(ctx);
  return promptSearch(ctx, {
    message: "Choose from an existing local deployment?",
    choices: localDeployments.map((d) => ({
      name: d.deploymentName,
      value: d
    }))
  });
}
//# sourceMappingURL=localDeployment.js.map
