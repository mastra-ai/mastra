"use strict";
import path from "path";
import {
  logFailure,
  logFinishedStep,
  logVerbose
} from "../../../bundler/log.js";
import { runSystemQuery } from "../run.js";
import {
  deploymentStateDir,
  loadDeploymentConfig,
  saveDeploymentConfig
} from "./filePaths.js";
import {
  ensureBackendStopped,
  localDeploymentUrl,
  runLocalBackend
} from "./run.js";
import {
  downloadSnapshotExport,
  startSnapshotExport
} from "../convexExport.js";
import { deploymentFetch, logAndHandleFetchError } from "../utils/utils.js";
import {
  confirmImport,
  uploadForImport,
  waitForStableImportState
} from "../convexImport.js";
import { promptOptions, promptYesNo } from "../utils/prompts.js";
import { recursivelyDelete } from "../fsUtils.js";
import { LocalDeploymentError } from "./errors.js";
import { ensureBackendBinaryDownloaded } from "./download.js";
export async function handlePotentialUpgrade(ctx, args) {
  const newConfig = {
    ports: args.ports,
    backendVersion: args.newVersion,
    adminKey: args.adminKey,
    instanceSecret: args.instanceSecret
  };
  if (args.oldVersion === null || args.oldVersion === args.newVersion) {
    saveDeploymentConfig(
      ctx,
      args.deploymentKind,
      args.deploymentName,
      newConfig
    );
    return runLocalBackend(ctx, {
      binaryPath: args.newBinaryPath,
      deploymentKind: args.deploymentKind,
      deploymentName: args.deploymentName,
      ports: args.ports,
      instanceSecret: args.instanceSecret,
      isLatestVersion: true
    });
  }
  logVerbose(
    `Considering upgrade from ${args.oldVersion} to ${args.newVersion}`
  );
  const confirmed = args.forceUpgrade || await promptYesNo(ctx, {
    message: `This deployment is using an older version of the Convex backend. Upgrade now?`,
    default: true
  });
  if (!confirmed) {
    const { binaryPath: oldBinaryPath } = await ensureBackendBinaryDownloaded(
      ctx,
      {
        kind: "version",
        version: args.oldVersion
      }
    );
    saveDeploymentConfig(ctx, args.deploymentKind, args.deploymentName, {
      ...newConfig,
      backendVersion: args.oldVersion
    });
    return runLocalBackend(ctx, {
      binaryPath: oldBinaryPath,
      ports: args.ports,
      deploymentKind: args.deploymentKind,
      deploymentName: args.deploymentName,
      instanceSecret: args.instanceSecret,
      isLatestVersion: false
    });
  }
  const choice = args.forceUpgrade ? "transfer" : await promptOptions(ctx, {
    message: "Transfer data from existing deployment?",
    default: "transfer",
    choices: [
      { name: "transfer data", value: "transfer" },
      { name: "start fresh", value: "reset" }
    ]
  });
  const deploymentStatePath = deploymentStateDir(
    args.deploymentKind,
    args.deploymentName
  );
  if (choice === "reset") {
    recursivelyDelete(ctx, deploymentStatePath, { force: true });
    saveDeploymentConfig(
      ctx,
      args.deploymentKind,
      args.deploymentName,
      newConfig
    );
    return runLocalBackend(ctx, {
      binaryPath: args.newBinaryPath,
      deploymentKind: args.deploymentKind,
      deploymentName: args.deploymentName,
      ports: args.ports,
      instanceSecret: args.instanceSecret,
      isLatestVersion: true
    });
  }
  const newAdminKey = args.adminKey;
  const oldAdminKey = loadDeploymentConfig(ctx, args.deploymentKind, args.deploymentName)?.adminKey ?? args.adminKey;
  return handleUpgrade(ctx, {
    deploymentKind: args.deploymentKind,
    deploymentName: args.deploymentName,
    oldVersion: args.oldVersion,
    newBinaryPath: args.newBinaryPath,
    newVersion: args.newVersion,
    ports: args.ports,
    oldAdminKey,
    newAdminKey,
    instanceSecret: args.instanceSecret
  });
}
async function handleUpgrade(ctx, args) {
  const { binaryPath: oldBinaryPath } = await ensureBackendBinaryDownloaded(
    ctx,
    {
      kind: "version",
      version: args.oldVersion
    }
  );
  logVerbose("Running backend on old version");
  const { cleanupHandle: oldCleanupHandle } = await runLocalBackend(ctx, {
    binaryPath: oldBinaryPath,
    ports: args.ports,
    deploymentKind: args.deploymentKind,
    deploymentName: args.deploymentName,
    instanceSecret: args.instanceSecret,
    isLatestVersion: false
  });
  logVerbose("Downloading env vars");
  const deploymentUrl = localDeploymentUrl(args.ports.cloud);
  const envs = await runSystemQuery(ctx, {
    deploymentUrl,
    adminKey: args.oldAdminKey,
    functionName: "_system/cli/queryEnvironmentVariables",
    componentPath: void 0,
    args: {}
  });
  logVerbose("Doing a snapshot export");
  const exportPath = path.join(
    deploymentStateDir(args.deploymentKind, args.deploymentName),
    "export.zip"
  );
  if (ctx.fs.exists(exportPath)) {
    ctx.fs.unlink(exportPath);
  }
  const snaphsotExportState = await startSnapshotExport(ctx, {
    deploymentUrl,
    adminKey: args.oldAdminKey,
    includeStorage: true,
    inputPath: exportPath
  });
  if (snaphsotExportState.state !== "completed") {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to export snapshot"
    });
  }
  await downloadSnapshotExport(ctx, {
    snapshotExportTs: snaphsotExportState.start_ts,
    inputPath: exportPath,
    adminKey: args.oldAdminKey,
    deploymentUrl
  });
  logVerbose("Stopping the backend on the old version");
  const oldCleanupFunc = ctx.removeCleanup(oldCleanupHandle);
  if (oldCleanupFunc) {
    await oldCleanupFunc(0);
  }
  await ensureBackendStopped(ctx, {
    ports: args.ports,
    maxTimeSecs: 5,
    deploymentName: args.deploymentName,
    allowOtherDeployments: false
  });
  logVerbose("Running backend on new version");
  const { cleanupHandle } = await runLocalBackend(ctx, {
    binaryPath: args.newBinaryPath,
    ports: args.ports,
    deploymentKind: args.deploymentKind,
    deploymentName: args.deploymentName,
    instanceSecret: args.instanceSecret,
    isLatestVersion: true
  });
  logVerbose("Importing the env vars");
  if (envs.length > 0) {
    const fetch = deploymentFetch(ctx, {
      deploymentUrl,
      adminKey: args.newAdminKey
    });
    try {
      await fetch("/api/update_environment_variables", {
        body: JSON.stringify({ changes: envs }),
        method: "POST"
      });
    } catch (e) {
      return await logAndHandleFetchError(ctx, e);
    }
  }
  logVerbose("Doing a snapshot import");
  const importId = await uploadForImport(ctx, {
    deploymentUrl,
    adminKey: args.newAdminKey,
    filePath: exportPath,
    importArgs: { format: "zip", mode: "replace", tableName: void 0 },
    onImportFailed: async (e) => {
      logFailure(`Failed to import snapshot: ${e}`);
    }
  });
  logVerbose(`Snapshot import started`);
  let status = await waitForStableImportState(ctx, {
    importId,
    deploymentUrl,
    adminKey: args.newAdminKey,
    onProgress: () => {
      return 0;
    }
  });
  if (status.state !== "waiting_for_confirmation") {
    const message = "Error while transferring data: Failed to upload snapshot";
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new LocalDeploymentError(message)
    });
  }
  await confirmImport(ctx, {
    importId,
    adminKey: args.newAdminKey,
    deploymentUrl,
    onError: async (e) => {
      logFailure(`Failed to confirm import: ${e}`);
    }
  });
  logVerbose(`Snapshot import confirmed`);
  status = await waitForStableImportState(ctx, {
    importId,
    deploymentUrl,
    adminKey: args.newAdminKey,
    onProgress: () => {
      return 0;
    }
  });
  logVerbose(`Snapshot import status: ${status.state}`);
  if (status.state !== "completed") {
    const message = "Error while transferring data: Failed to import snapshot";
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new LocalDeploymentError(message)
    });
  }
  logFinishedStep("Successfully upgraded to a new backend version");
  saveDeploymentConfig(ctx, args.deploymentKind, args.deploymentName, {
    ports: args.ports,
    backendVersion: args.newVersion,
    adminKey: args.newAdminKey,
    instanceSecret: args.instanceSecret
  });
  return { cleanupHandle };
}
//# sourceMappingURL=upgrade.js.map
