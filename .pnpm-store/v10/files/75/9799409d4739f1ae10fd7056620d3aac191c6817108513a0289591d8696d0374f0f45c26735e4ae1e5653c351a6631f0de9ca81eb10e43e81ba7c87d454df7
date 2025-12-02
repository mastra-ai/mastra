"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var localDeployment_exports = {};
__export(localDeployment_exports, {
  handleLocalDeployment: () => handleLocalDeployment,
  loadLocalDeploymentCredentials: () => loadLocalDeploymentCredentials
});
module.exports = __toCommonJS(localDeployment_exports);
var import_log = require("../../../bundler/log.js");
var import_bigBrain = require("./bigBrain.js");
var import_filePaths = require("./filePaths.js");
var import_run = require("./run.js");
var import_upgrade = require("./upgrade.js");
var import_prompts = require("../utils/prompts.js");
var import_errors = require("./errors.js");
var import_utils = require("./utils.js");
var import_download = require("./download.js");
async function handleLocalDeployment(ctx, options) {
  if (await (0, import_utils.isOffline)()) {
    return handleOffline(ctx, options);
  }
  const existingDeploymentForProject = await getExistingDeployment(ctx, {
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug
  });
  if (existingDeploymentForProject === null) {
    (0, import_utils.printLocalDeploymentWelcomeMessage)();
  }
  ctx.registerCleanup(async (_exitCode, err) => {
    if (err instanceof import_errors.LocalDeploymentError) {
      (0, import_errors.printLocalDeploymentOnError)();
    }
  });
  if (existingDeploymentForProject !== null) {
    (0, import_log.logVerbose)(`Found existing deployment for project ${options.projectSlug}`);
    await (0, import_run.ensureBackendStopped)(ctx, {
      ports: {
        cloud: existingDeploymentForProject.config.ports.cloud
      },
      maxTimeSecs: 5,
      deploymentName: existingDeploymentForProject.deploymentName,
      allowOtherDeployments: true
    });
  }
  const { binaryPath, version } = await (0, import_download.ensureBackendBinaryDownloaded)(
    ctx,
    options.backendVersion === void 0 ? {
      kind: "latest",
      allowedVersion: existingDeploymentForProject?.config.backendVersion
    } : { kind: "version", version: options.backendVersion }
  );
  const [cloudPort, sitePort] = await (0, import_utils.choosePorts)(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null]
  });
  const { deploymentName, adminKey } = await (0, import_bigBrain.bigBrainStart)(ctx, {
    port: cloudPort,
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug,
    instanceName: existingDeploymentForProject?.deploymentName ?? null
  });
  const onActivity = async (isOffline2, _wasOffline) => {
    await (0, import_run.ensureBackendRunning)(ctx, {
      cloudPort,
      deploymentName,
      maxTimeSecs: 5
    });
    if (isOffline2) {
      return;
    }
    await (0, import_bigBrain.bigBrainRecordActivity)(ctx, {
      instanceName: deploymentName
    });
  };
  const { cleanupHandle } = await (0, import_upgrade.handlePotentialUpgrade)(ctx, {
    deploymentKind: "local",
    deploymentName,
    oldVersion: existingDeploymentForProject?.config.backendVersion ?? null,
    newBinaryPath: binaryPath,
    newVersion: version,
    ports: { cloud: cloudPort, site: sitePort },
    adminKey,
    instanceSecret: import_utils.LOCAL_BACKEND_INSTANCE_SECRET,
    forceUpgrade: options.forceUpgrade
  });
  const cleanupFunc = ctx.removeCleanup(cleanupHandle);
  ctx.registerCleanup(async (exitCode, err) => {
    if (cleanupFunc !== null) {
      await cleanupFunc(exitCode, err);
    }
    await (0, import_bigBrain.bigBrainPause)(ctx, {
      projectSlug: options.projectSlug,
      teamSlug: options.teamSlug
    });
  });
  return {
    adminKey,
    deploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(cloudPort),
    onActivity
  };
}
async function loadLocalDeploymentCredentials(ctx, deploymentName) {
  const config = (0, import_filePaths.loadDeploymentConfig)(ctx, "local", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config"
    });
  }
  return {
    deploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(config.ports.cloud),
    adminKey: config.adminKey
  };
}
async function handleOffline(ctx, options) {
  const { deploymentName, config } = await chooseFromExistingLocalDeployments(ctx);
  const { binaryPath } = await (0, import_download.ensureBackendBinaryDownloaded)(ctx, {
    kind: "version",
    version: config.backendVersion
  });
  const [cloudPort, sitePort] = await (0, import_utils.choosePorts)(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null]
  });
  (0, import_filePaths.saveDeploymentConfig)(ctx, "local", deploymentName, config);
  await (0, import_run.runLocalBackend)(ctx, {
    binaryPath,
    ports: { cloud: cloudPort, site: sitePort },
    deploymentName,
    deploymentKind: "local",
    instanceSecret: import_utils.LOCAL_BACKEND_INSTANCE_SECRET,
    isLatestVersion: false
  });
  return {
    adminKey: config.adminKey,
    deploymentName,
    deploymentUrl: (0, import_run.localDeploymentUrl)(cloudPort),
    onActivity: async (isOffline2, wasOffline) => {
      await (0, import_run.ensureBackendRunning)(ctx, {
        cloudPort,
        deploymentName,
        maxTimeSecs: 5
      });
      if (isOffline2) {
        return;
      }
      if (wasOffline) {
        await (0, import_bigBrain.bigBrainStart)(ctx, {
          port: cloudPort,
          projectSlug: options.projectSlug,
          teamSlug: options.teamSlug,
          instanceName: deploymentName
        });
      }
      await (0, import_bigBrain.bigBrainRecordActivity)(ctx, {
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
  const dir = (0, import_filePaths.rootDeploymentStateDir)("local");
  if (!ctx.fs.exists(dir)) {
    return [];
  }
  const deploymentNames = ctx.fs.listDir(dir).map((d) => d.name).filter((d) => d.startsWith("local-"));
  return deploymentNames.flatMap((deploymentName) => {
    const config = (0, import_filePaths.loadDeploymentConfig)(ctx, "local", deploymentName);
    if (config !== null) {
      return [{ deploymentName, config }];
    }
    return [];
  });
}
async function chooseFromExistingLocalDeployments(ctx) {
  const localDeployments = await getLocalDeployments(ctx);
  return (0, import_prompts.promptSearch)(ctx, {
    message: "Choose from an existing local deployment?",
    choices: localDeployments.map((d) => ({
      name: d.deploymentName,
      value: d
    }))
  });
}
//# sourceMappingURL=localDeployment.js.map
