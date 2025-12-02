import { Context } from "../../../bundler/context.js";
import { logVerbose, logMessage } from "../../../bundler/log.js";
import {
  LocalDeploymentKind,
  deploymentStateDir,
  loadUuidForAnonymousUser,
} from "./filePaths.js";
import path from "path";
import child_process from "child_process";
import detect from "detect-port";
import { SENTRY_DSN } from "../utils/sentry.js";
import { createHash } from "crypto";
import { LocalDeploymentError } from "./errors.js";

export async function runLocalBackend(
  ctx: Context,
  args: {
    ports: {
      cloud: number;
      site: number;
    };
    deploymentKind: LocalDeploymentKind;
    deploymentName: string;
    binaryPath: string;
    instanceSecret: string;
    isLatestVersion: boolean;
  },
): Promise<{
  cleanupHandle: string;
}> {
  const { ports } = args;
  const deploymentDir = deploymentStateDir(
    args.deploymentKind,
    args.deploymentName,
  );
  ctx.fs.mkdir(deploymentDir, { recursive: true });
  const deploymentNameSha = createHash("sha256")
    .update(args.deploymentName)
    .digest("hex");
  const commandArgs = [
    "--port",
    ports.cloud.toString(),
    "--site-proxy-port",
    ports.site.toString(),
    "--sentry-identifier",
    deploymentNameSha,
    "--instance-name",
    args.deploymentName,
    "--instance-secret",
    args.instanceSecret,
    "--local-storage",
    path.join(deploymentDir, "convex_local_storage"),
    "--beacon-tag",
    selfHostedEventTag(args.deploymentKind),
    path.join(deploymentDir, "convex_local_backend.sqlite3"),
  ];
  if (args.isLatestVersion) {
    // CLI args that were added in later versions of backend go here instead of above
    // since the CLI may run older versions of backend (e.g. when upgrading).
    if (args.deploymentKind === "anonymous") {
      const uuid = loadUuidForAnonymousUser(ctx);
      if (uuid !== null) {
        commandArgs.push(
          "--beacon-fields",
          JSON.stringify({
            override_uuid: uuid,
          }),
        );
      }
    }
  }

  // Check that binary works by running with --help
  try {
    const result = child_process.spawnSync(args.binaryPath, [
      ...commandArgs,
      "--help",
    ]);
    if (result.status === 3221225781) {
      const message =
        "Local backend exited because shared libraries are missing. These may include libraries installed via 'Microsoft Visual C++ Redistributable for Visual Studio.'";
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: message,
        errForSentry: new LocalDeploymentError(
          "Local backend exited with code 3221225781",
        ),
      });
    } else if (result.status !== 0) {
      const message = `Failed to run backend binary, exit code ${result.status}, error: ${result.stderr === null ? "null" : result.stderr.toString()}`;
      return ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: message,
        errForSentry: new LocalDeploymentError(message),
      });
    }
  } catch (e) {
    const message = `Failed to run backend binary: ${(e as any).toString()}`;
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new LocalDeploymentError(message),
    });
  }
  const commandStr = `${args.binaryPath} ${commandArgs.join(" ")}`;
  logVerbose(`Starting local backend: \`${commandStr}\``);
  const p = child_process
    .spawn(args.binaryPath, commandArgs, {
      stdio: "ignore",
      env: {
        ...process.env,
        SENTRY_DSN: SENTRY_DSN,
      },
    })
    .on("exit", (code) => {
      const why = code === null ? "from signal" : `with code ${code}`;
      logVerbose(`Local backend exited ${why}, full command \`${commandStr}\``);
    });
  const cleanupHandle = ctx.registerCleanup(async () => {
    logVerbose(`Stopping local backend on port ${ports.cloud}`);
    p.kill("SIGTERM");
  });

  await ensureBackendRunning(ctx, {
    cloudPort: ports.cloud,
    deploymentName: args.deploymentName,
    maxTimeSecs: 30,
  });

  return {
    cleanupHandle,
  };
}

/** Crash if correct local backend is not currently listening on the expected port. */
export async function assertLocalBackendRunning(
  ctx: Context,
  args: {
    url: string;
    deploymentName: string;
  },
): Promise<void> {
  logVerbose(`Checking local backend at ${args.url} is running`);
  try {
    const resp = await fetch(`${args.url}/instance_name`);
    if (resp.status === 200) {
      const text = await resp.text();
      if (text !== args.deploymentName) {
        return await ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `A different local backend ${text} is running at ${args.url}`,
        });
      } else {
        return;
      }
    } else {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Error response code received from local backend ${resp.status} ${resp.statusText}`,
      });
    }
  } catch {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Local backend isn't running. (it's not listening at ${args.url})\nRun \`npx convex dev\` in another terminal first.`,
    });
  }
}

/** Wait for up to maxTimeSecs for the correct local backend to be running on the expected port. */
export async function ensureBackendRunning(
  ctx: Context,
  args: {
    cloudPort: number;
    deploymentName: string;
    maxTimeSecs: number;
  },
): Promise<void> {
  logVerbose(`Ensuring backend running on port ${args.cloudPort} is running`);
  const deploymentUrl = localDeploymentUrl(args.cloudPort);
  let timeElapsedSecs = 0;
  let hasShownWaiting = false;
  while (timeElapsedSecs <= args.maxTimeSecs) {
    if (!hasShownWaiting && timeElapsedSecs > 2) {
      logMessage("waiting for local backend to start...");
      hasShownWaiting = true;
    }
    try {
      const resp = await fetch(`${deploymentUrl}/instance_name`);
      if (resp.status === 200) {
        const text = await resp.text();
        if (text !== args.deploymentName) {
          return await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `A different local backend ${text} is running on selected port ${args.cloudPort}`,
          });
        } else {
          // The backend is running!
          return;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
        timeElapsedSecs += 0.5;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      timeElapsedSecs += 0.5;
    }
  }
  const message = `Local backend did not start on port ${args.cloudPort} within ${args.maxTimeSecs} seconds.`;
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: message,
    errForSentry: new LocalDeploymentError(message),
  });
}

export async function ensureBackendStopped(
  ctx: Context,
  args: {
    ports: {
      cloud: number;
      site?: number;
    };
    maxTimeSecs: number;
    deploymentName: string;
    // Whether to allow a deployment with a different name to run on this port
    allowOtherDeployments: boolean;
  },
) {
  logVerbose(`Ensuring backend running on port ${args.ports.cloud} is stopped`);
  let timeElapsedSecs = 0;
  while (timeElapsedSecs < args.maxTimeSecs) {
    const cloudPort = await detect(args.ports.cloud);
    const sitePort =
      args.ports.site === undefined ? undefined : await detect(args.ports.site);
    // Both ports are free
    if (cloudPort === args.ports.cloud && sitePort === args.ports.site) {
      return;
    }
    try {
      const instanceNameResp = await fetch(
        `${localDeploymentUrl(args.ports.cloud)}/instance_name`,
      );
      if (instanceNameResp.ok) {
        const instanceName = await instanceNameResp.text();
        if (instanceName !== args.deploymentName) {
          if (args.allowOtherDeployments) {
            return;
          }
          return await ctx.crash({
            exitCode: 1,
            errorType: "fatal",
            printedMessage: `A different local backend ${instanceName} is running on selected port ${args.ports.cloud}`,
          });
        }
      }
    } catch (error: any) {
      logVerbose(`Error checking if backend is running: ${error.message}`);
      // Backend is probably not running
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    timeElapsedSecs += 0.5;
  }
  return ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `A local backend is still running on port ${args.ports.cloud}. Please stop it and run this command again.`,
  });
}

export function localDeploymentUrl(cloudPort: number): string {
  return `http://127.0.0.1:${cloudPort}`;
}

export function selfHostedEventTag(
  deploymentKind: LocalDeploymentKind,
): string {
  return deploymentKind === "local" ? "cli-local-dev" : "cli-anonymous-dev";
}
