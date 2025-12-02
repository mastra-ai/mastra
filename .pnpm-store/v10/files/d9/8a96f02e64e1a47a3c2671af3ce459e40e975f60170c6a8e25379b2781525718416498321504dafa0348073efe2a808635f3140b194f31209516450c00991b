import chalk from "chalk";
import {
  waitUntilCalled,
  deploymentFetch,
  logAndHandleFetchError,
} from "./utils/utils.js";
import { Context } from "../../bundler/context.js";
import {
  logFailure,
  showSpinner,
  logFinishedStep,
  logError,
  stopSpinner,
  changeSpinner,
} from "../../bundler/log.js";
import { subscribe } from "./run.js";
import { nodeFs } from "../../bundler/fs.js";
import path from "path";
import { Readable } from "stream";
import { stringifyValueForError } from "../../values/value.js";

export async function exportFromDeployment(
  ctx: Context,
  options: {
    deploymentUrl: string;
    adminKey: string;
    path: string;
    includeFileStorage?: boolean;
    deploymentNotice: string;
    snapshotExportDashboardLink: string | undefined;
  },
) {
  const includeStorage = !!options.includeFileStorage;
  const {
    deploymentUrl,
    adminKey,
    path: inputPath,
    deploymentNotice,
    snapshotExportDashboardLink,
  } = options;

  showSpinner(`Creating snapshot export${deploymentNotice}`);

  const snapshotExportState = await startSnapshotExport(ctx, {
    includeStorage,
    inputPath,
    adminKey,
    deploymentUrl,
  });

  switch (snapshotExportState.state) {
    case "completed":
      stopSpinner();
      logFinishedStep(
        `Created snapshot export at timestamp ${snapshotExportState.start_ts}`,
      );
      if (snapshotExportDashboardLink !== undefined) {
        logFinishedStep(
          `Export is available at ${snapshotExportDashboardLink}`,
        );
      }
      break;
    case "requested":
    case "in_progress": {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `WARNING: Export is continuing to run on the server.`,
      });
    }
    case "failed": {
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `Export failed. Please try again later or contact support@convex.dev for help.`,
      });
    }
    default: {
      snapshotExportState satisfies never;
      return await ctx.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: `unknown error: unexpected state ${stringifyValueForError(snapshotExportState as any)}`,
        errForSentry: `unexpected snapshot export state ${(snapshotExportState as any).state}`,
      });
    }
  }

  showSpinner(`Downloading snapshot export to ${chalk.bold(inputPath)}`);
  const { filePath } = await downloadSnapshotExport(ctx, {
    snapshotExportTs: snapshotExportState.start_ts,
    inputPath,
    adminKey,
    deploymentUrl,
  });
  stopSpinner();
  logFinishedStep(`Downloaded snapshot export to ${chalk.bold(filePath)}`);
}

type SnapshotExportState =
  | { state: "requested" }
  | { state: "in_progress" }
  | { state: "failed" }
  | {
      state: "completed";
      complete_ts: bigint;
      start_ts: bigint;
      zip_object_key: string;
    };

async function waitForStableExportState(
  ctx: Context,
  deploymentUrl: string,
  adminKey: string,
): Promise<SnapshotExportState> {
  const [donePromise, onDone] = waitUntilCalled();
  let snapshotExportState: SnapshotExportState;
  await subscribe(ctx, {
    deploymentUrl,
    adminKey,
    parsedFunctionName: "_system/cli/exports:getLatest",
    parsedFunctionArgs: {},
    componentPath: undefined,
    until: donePromise,
    callbacks: {
      onChange: (value: any) => {
        // NOTE: `value` would only be `null` if there has never been an export
        // requested.
        snapshotExportState = value;
        switch (snapshotExportState.state) {
          case "requested":
          case "in_progress":
            // Not a stable state.
            break;
          case "completed":
          case "failed":
            onDone();
            break;
          default: {
            snapshotExportState satisfies never;
            onDone();
          }
        }
      },
    },
  });
  return snapshotExportState!;
}

export async function startSnapshotExport(
  ctx: Context,
  args: {
    includeStorage: boolean;
    inputPath: string;
    adminKey: string;
    deploymentUrl: string;
  },
) {
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey,
  });
  try {
    await fetch(
      `/api/export/request/zip?includeStorage=${args.includeStorage}`,
      {
        method: "POST",
      },
    );
  } catch (e) {
    return await logAndHandleFetchError(ctx, e);
  }

  const snapshotExportState = await waitForStableExportState(
    ctx,
    args.deploymentUrl,
    args.adminKey,
  );
  return snapshotExportState;
}

export async function downloadSnapshotExport(
  ctx: Context,
  args: {
    snapshotExportTs: bigint;
    inputPath: string;
    adminKey: string;
    deploymentUrl: string;
  },
): Promise<{ filePath: string }> {
  const inputPath = args.inputPath;
  const exportUrl = `/api/export/zip/${args.snapshotExportTs.toString()}`;
  const fetch = deploymentFetch(ctx, {
    deploymentUrl: args.deploymentUrl,
    adminKey: args.adminKey,
  });
  let response: Response;
  try {
    response = await fetch(exportUrl, {
      method: "GET",
    });
  } catch (e) {
    return await logAndHandleFetchError(ctx, e);
  }

  let filePath;
  if (ctx.fs.exists(inputPath)) {
    const st = ctx.fs.stat(inputPath);
    if (st.isDirectory()) {
      const contentDisposition =
        response.headers.get("content-disposition") ?? "";
      let filename = `snapshot_${args.snapshotExportTs.toString()}.zip`;
      if (contentDisposition.startsWith("attachment; filename=")) {
        filename = contentDisposition.slice("attachment; filename=".length);
      }
      filePath = path.join(inputPath, filename);
    } else {
      // TODO(sarah) -- if this is called elsewhere, I'd like to catch the error + potentially
      // have different logging
      return await ctx.crash({
        exitCode: 1,
        errorType: "invalid filesystem data",
        printedMessage: `Error: Path ${chalk.bold(inputPath)} already exists.`,
      });
    }
  } else {
    filePath = inputPath;
  }
  changeSpinner(`Downloading snapshot export to ${chalk.bold(filePath)}`);

  try {
    await nodeFs.writeFileStream(
      filePath,
      Readable.fromWeb(response.body! as any),
    );
  } catch (e) {
    logFailure(`Exporting data failed`);
    logError(chalk.red(e));
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Exporting data failed: ${chalk.red(e)}`,
    });
  }
  return { filePath };
}
