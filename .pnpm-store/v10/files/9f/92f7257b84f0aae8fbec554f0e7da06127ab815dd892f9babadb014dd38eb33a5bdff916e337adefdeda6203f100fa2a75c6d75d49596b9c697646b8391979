import { Context } from "../../../bundler/context.js";
import { logVerbose } from "../../../bundler/log.js";
import {
  bigBrainPause,
  bigBrainRecordActivity,
  bigBrainStart,
} from "./bigBrain.js";
import {
  LocalDeploymentConfig,
  loadDeploymentConfig,
  rootDeploymentStateDir,
  saveDeploymentConfig,
} from "./filePaths.js";
import {
  ensureBackendRunning,
  ensureBackendStopped,
  localDeploymentUrl,
  runLocalBackend,
} from "./run.js";
import { handlePotentialUpgrade } from "./upgrade.js";
import { OnDeploymentActivityFunc } from "../deployment.js";
import { promptSearch } from "../utils/prompts.js";
import { LocalDeploymentError, printLocalDeploymentOnError } from "./errors.js";
import {
  choosePorts,
  printLocalDeploymentWelcomeMessage,
  isOffline,
  LOCAL_BACKEND_INSTANCE_SECRET,
} from "./utils.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
export type DeploymentDetails = {
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
  onActivity: OnDeploymentActivityFunc;
};

export async function handleLocalDeployment(
  ctx: Context,
  options: {
    teamSlug: string;
    projectSlug: string;
    ports?:
      | {
          cloud: number;
          site: number;
        }
      | undefined;
    backendVersion?: string | undefined;
    forceUpgrade: boolean;
  },
): Promise<DeploymentDetails> {
  if (await isOffline()) {
    return handleOffline(ctx, options);
  }

  const existingDeploymentForProject = await getExistingDeployment(ctx, {
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug,
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
    // If it's still running for some reason, exit and tell the user to kill it.
    // It's fine if a different backend is running on these ports though since we'll
    // pick new ones.
    await ensureBackendStopped(ctx, {
      ports: {
        cloud: existingDeploymentForProject.config.ports.cloud,
      },
      maxTimeSecs: 5,
      deploymentName: existingDeploymentForProject.deploymentName,
      allowOtherDeployments: true,
    });
  }

  const { binaryPath, version } = await ensureBackendBinaryDownloaded(
    ctx,
    options.backendVersion === undefined
      ? {
          kind: "latest",
          allowedVersion: existingDeploymentForProject?.config.backendVersion,
        }
      : { kind: "version", version: options.backendVersion },
  );
  const [cloudPort, sitePort] = await choosePorts(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null],
  });
  const { deploymentName, adminKey } = await bigBrainStart(ctx, {
    port: cloudPort,
    projectSlug: options.projectSlug,
    teamSlug: options.teamSlug,
    instanceName: existingDeploymentForProject?.deploymentName ?? null,
  });
  const onActivity = async (isOffline: boolean, _wasOffline: boolean) => {
    await ensureBackendRunning(ctx, {
      cloudPort,
      deploymentName,
      maxTimeSecs: 5,
    });
    if (isOffline) {
      return;
    }
    await bigBrainRecordActivity(ctx, {
      instanceName: deploymentName,
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
    forceUpgrade: options.forceUpgrade,
  });

  const cleanupFunc = ctx.removeCleanup(cleanupHandle);
  ctx.registerCleanup(async (exitCode, err) => {
    if (cleanupFunc !== null) {
      await cleanupFunc(exitCode, err);
    }
    await bigBrainPause(ctx, {
      projectSlug: options.projectSlug,
      teamSlug: options.teamSlug,
    });
  });

  return {
    adminKey,
    deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    onActivity,
  };
}

export async function loadLocalDeploymentCredentials(
  ctx: Context,
  deploymentName: string,
): Promise<{
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
}> {
  const config = loadDeploymentConfig(ctx, "local", deploymentName);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to load deployment config",
    });
  }
  return {
    deploymentName,
    deploymentUrl: localDeploymentUrl(config.ports.cloud),
    adminKey: config.adminKey,
  };
}

async function handleOffline(
  ctx: Context,
  options: {
    teamSlug: string;
    projectSlug: string;
    ports?: { cloud: number; site: number } | undefined;
  },
): Promise<DeploymentDetails> {
  const { deploymentName, config } =
    await chooseFromExistingLocalDeployments(ctx);
  const { binaryPath } = await ensureBackendBinaryDownloaded(ctx, {
    kind: "version",
    version: config.backendVersion,
  });
  const [cloudPort, sitePort] = await choosePorts(ctx, {
    count: 2,
    startPort: 3210,
    requestedPorts: [options.ports?.cloud ?? null, options.ports?.site ?? null],
  });
  saveDeploymentConfig(ctx, "local", deploymentName, config);
  await runLocalBackend(ctx, {
    binaryPath,
    ports: { cloud: cloudPort, site: sitePort },
    deploymentName,
    deploymentKind: "local",
    instanceSecret: LOCAL_BACKEND_INSTANCE_SECRET,
    isLatestVersion: false,
  });
  return {
    adminKey: config.adminKey,
    deploymentName,
    deploymentUrl: localDeploymentUrl(cloudPort),
    onActivity: async (isOffline: boolean, wasOffline: boolean) => {
      await ensureBackendRunning(ctx, {
        cloudPort,
        deploymentName,
        maxTimeSecs: 5,
      });
      if (isOffline) {
        return;
      }
      if (wasOffline) {
        await bigBrainStart(ctx, {
          port: cloudPort,
          projectSlug: options.projectSlug,
          teamSlug: options.teamSlug,
          instanceName: deploymentName,
        });
      }
      await bigBrainRecordActivity(ctx, {
        instanceName: deploymentName,
      });
    },
  };
}

async function getExistingDeployment(
  ctx: Context,
  options: {
    projectSlug: string;
    teamSlug: string;
  },
): Promise<{ deploymentName: string; config: LocalDeploymentConfig } | null> {
  const { projectSlug, teamSlug } = options;
  const prefix = `local-${teamSlug.replace(/-/g, "_")}-${projectSlug.replace(/-/g, "_")}`;
  const localDeployments = await getLocalDeployments(ctx);
  const existingDeploymentForProject = localDeployments.find((d) =>
    d.deploymentName.startsWith(prefix),
  );
  if (existingDeploymentForProject === undefined) {
    return null;
  }
  return {
    deploymentName: existingDeploymentForProject.deploymentName,
    config: existingDeploymentForProject.config,
  };
}

async function getLocalDeployments(ctx: Context): Promise<
  Array<{
    deploymentName: string;
    config: LocalDeploymentConfig;
  }>
> {
  const dir = rootDeploymentStateDir("local");
  if (!ctx.fs.exists(dir)) {
    return [];
  }
  const deploymentNames = ctx.fs
    .listDir(dir)
    .map((d) => d.name)
    .filter((d) => d.startsWith("local-"));
  return deploymentNames.flatMap((deploymentName) => {
    const config = loadDeploymentConfig(ctx, "local", deploymentName);
    if (config !== null) {
      return [{ deploymentName, config }];
    }
    return [];
  });
}

async function chooseFromExistingLocalDeployments(ctx: Context): Promise<{
  deploymentName: string;
  config: LocalDeploymentConfig;
}> {
  const localDeployments = await getLocalDeployments(ctx);
  return promptSearch(ctx, {
    message: "Choose from an existing local deployment?",
    choices: localDeployments.map((d) => ({
      name: d.deploymentName,
      value: d,
    })),
  });
}
