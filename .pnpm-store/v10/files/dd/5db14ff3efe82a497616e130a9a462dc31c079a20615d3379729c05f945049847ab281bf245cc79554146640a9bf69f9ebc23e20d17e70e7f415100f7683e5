import AdmZip from "adm-zip";
import { Context } from "../../../bundler/context.js";
import {
  logFinishedStep,
  startLogProgress,
  logVerbose,
  logMessage,
  logError,
  logWarning,
} from "../../../bundler/log.js";
import {
  dashboardZip,
  executablePath,
  versionedBinaryDir,
  dashboardOutDir,
  resetDashboardDir,
  loadDashboardConfig,
  executableName,
} from "./filePaths.js";
import child_process from "child_process";
import { promisify } from "util";
import { Readable } from "stream";
import { TempPath, nodeFs, withTmpDir } from "../../../bundler/fs.js";
import { components } from "@octokit/openapi-types";
import { recursivelyDelete, recursivelyCopy } from "../fsUtils.js";
import { LocalDeploymentError } from "./errors.js";
import type { ProgressBarInstance } from "../../../vendor/progress/index.js";
import path from "path";

async function makeExecutable(p: string) {
  switch (process.platform) {
    case "darwin":
    case "linux": {
      await promisify(child_process.exec)(`chmod +x ${p}`);
    }
  }
}

type GitHubRelease = components["schemas"]["release"];

export async function ensureBackendBinaryDownloaded(
  ctx: Context,
  version:
    | { kind: "latest"; allowedVersion?: string | undefined }
    | { kind: "version"; version: string },
): Promise<{ binaryPath: string; version: string }> {
  if (version.kind === "version") {
    return _ensureBackendBinaryDownloaded(ctx, version.version);
  }
  if (version.allowedVersion) {
    const latestVersionWithBinary = await findLatestVersionWithBinary(
      ctx,
      false,
    );
    if (latestVersionWithBinary === null) {
      logWarning(
        `Failed to get latest version from GitHub, using downloaded version ${version.allowedVersion}`,
      );
      return _ensureBackendBinaryDownloaded(ctx, version.allowedVersion);
    }
    return _ensureBackendBinaryDownloaded(ctx, latestVersionWithBinary);
  }
  const latestVersionWithBinary = await findLatestVersionWithBinary(ctx, true);
  return _ensureBackendBinaryDownloaded(ctx, latestVersionWithBinary);
}

async function _ensureBackendBinaryDownloaded(
  ctx: Context,
  version: string,
): Promise<{ binaryPath: string; version: string }> {
  logVerbose(`Ensuring backend binary downloaded for version ${version}`);
  const existingDownload = await checkForExistingDownload(ctx, version);
  if (existingDownload !== null) {
    logVerbose(`Using existing download at ${existingDownload}`);
    return {
      binaryPath: existingDownload,
      version,
    };
  }
  const binaryPath = await downloadBackendBinary(ctx, version);
  return { version, binaryPath };
}

/**
 * Parse the HTTP header like
 * link: <https://api.github.com/repositories/1300192/issues?page=2>; rel="prev", <https://api.github.com/repositories/1300192/issues?page=4>; rel="next", <https://api.github.com/repositories/1300192/issues?page=515>; rel="last", <https://api.github.com/repositories/1300192/issues?page=1>; rel="first"
 * into an object.
 * https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2022-11-28#using-link-headers
 */
function parseLinkHeader(header: string): {
  prev?: string;
  next?: string;
  first?: string;
  last?: string;
} {
  const links: { [key: string]: string } = {};
  const parts = header.split(",");
  for (const part of parts) {
    const section = part.split(";");
    if (section.length !== 2) {
      continue;
    }
    const url = section[0].trim().slice(1, -1);
    const rel = section[1].trim().slice(5, -1);
    links[rel] = url;
  }
  return links;
}

/**
 * Finds the latest version of the convex backend that has a binary that works
 * on this platform.
 */
export async function findLatestVersionWithBinary<
  RequireSuccess extends boolean,
>(
  ctx: Context,
  requireSuccess: RequireSuccess,
): Promise<RequireSuccess extends true ? string : string | null> {
  // These shouldn't crash when there's a perfectly good binary already available.
  async function maybeCrash(
    ...args: Parameters<typeof ctx.crash>
  ): Promise<RequireSuccess extends true ? never : null> {
    if (requireSuccess) {
      return await ctx.crash(...args);
    }
    if (args[0].printedMessage) {
      logError(args[0].printedMessage);
    } else {
      logError("Error downloading latest binary");
    }
    return null as RequireSuccess extends true ? never : null;
  }

  const targetName = getDownloadPath();
  logVerbose(
    `Finding latest stable release containing binary named ${targetName}`,
  );
  let latestVersion: string | undefined;
  let nextUrl =
    "https://api.github.com/repos/get-convex/convex-backend/releases?per_page=30";

  try {
    while (nextUrl) {
      const response = await fetch(nextUrl);

      if (!response.ok) {
        const text = await response.text();
        return await maybeCrash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: `GitHub API returned ${response.status}: ${text}`,
          errForSentry: new LocalDeploymentError(
            `GitHub API returned ${response.status}: ${text}`,
          ),
        });
      }

      const releases = (await response.json()) as GitHubRelease[];
      if (releases.length === 0) {
        break;
      }

      for (const release of releases) {
        // Track the latest stable version we've seen even if it doesn't have our binary
        if (!latestVersion && !release.prerelease && !release.draft) {
          latestVersion = release.tag_name;
          logVerbose(`Latest stable version is ${latestVersion}`);
        }

        // Only consider stable releases
        if (!release.prerelease && !release.draft) {
          // Check if this release has our binary
          if (release.assets.find((asset) => asset.name === targetName)) {
            logVerbose(
              `Latest stable version with appropriate binary is ${release.tag_name}`,
            );
            return release.tag_name;
          }

          logVerbose(
            `Version ${release.tag_name} does not contain a ${targetName}, checking previous version`,
          );
        }
      }

      // Get the next page URL from the Link header
      const linkHeader = response.headers.get("Link");
      if (!linkHeader) {
        break;
      }

      const links = parseLinkHeader(linkHeader);
      nextUrl = links["next"] || "";
    }

    // If we get here, we didn't find any suitable releases
    if (!latestVersion) {
      return await maybeCrash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage:
          "Found no non-draft, non-prerelease convex backend releases.",
        errForSentry: new LocalDeploymentError(
          "Found no non-draft, non-prerelease convex backend releases.",
        ),
      });
    }

    // If we found stable releases but none had our binary
    const message = `Failed to find a convex backend release that contained ${targetName}.`;
    return await maybeCrash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new LocalDeploymentError(message),
    });
  } catch (e) {
    return maybeCrash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to get latest convex backend releases",
      errForSentry: new LocalDeploymentError(e?.toString()),
    });
  }
}

/**
 *
 * @param ctx
 * @param version
 * @returns The binary path if it exists, or null
 */
async function checkForExistingDownload(
  ctx: Context,
  version: string,
): Promise<string | null> {
  const destDir = versionedBinaryDir(version);
  if (!ctx.fs.exists(destDir)) {
    return null;
  }
  const p = executablePath(version);
  if (!ctx.fs.exists(p)) {
    // This directory isn't what we expected. Remove it.
    recursivelyDelete(ctx, destDir, { force: true });
    return null;
  }
  await makeExecutable(p);
  return p;
}

async function downloadBackendBinary(
  ctx: Context,
  version: string,
): Promise<string> {
  const downloadPath = getDownloadPath();
  // Note: We validate earlier that there's a binary for this platform at the specified version,
  // so in practice, we should never hit errors here.
  if (downloadPath === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Unsupported platform ${process.platform} and architecture ${process.arch} for local deployment.`,
    });
  }
  await downloadZipFile(ctx, {
    version,
    filename: downloadPath,
    nameForLogging: "Convex backend binary",
    onDownloadComplete: async (ctx, unzippedPath) => {
      const name = executableName();
      const tempExecPath = path.join(unzippedPath, name);
      await makeExecutable(tempExecPath);
      logVerbose("Marked as executable");
      ctx.fs.mkdir(versionedBinaryDir(version), { recursive: true });
      ctx.fs.swapTmpFile(tempExecPath as TempPath, executablePath(version));
    },
  });
  return executablePath(version);
}

/**
 * Get the artifact name, composed of the target convex-local-backend and
 * the Rust "target triple" appropriate for the current machine.
 **/
function getDownloadPath() {
  switch (process.platform) {
    case "darwin":
      if (process.arch === "arm64") {
        return "convex-local-backend-aarch64-apple-darwin.zip";
      } else if (process.arch === "x64") {
        return "convex-local-backend-x86_64-apple-darwin.zip";
      }
      break;
    case "linux":
      if (process.arch === "arm64") {
        return "convex-local-backend-aarch64-unknown-linux-gnu.zip";
      } else if (process.arch === "x64") {
        return "convex-local-backend-x86_64-unknown-linux-gnu.zip";
      }
      break;
    case "win32":
      return "convex-local-backend-x86_64-pc-windows-msvc.zip";
  }
  return null;
}

function getGithubDownloadUrl(version: string, filename: string) {
  return `https://github.com/get-convex/convex-backend/releases/download/${version}/${filename}`;
}

async function downloadZipFile(
  ctx: Context,
  args: {
    version: string;
    filename: string;
    nameForLogging: string;
    onDownloadComplete: (ctx: Context, unzippedPath: TempPath) => Promise<void>;
  },
) {
  const { version, filename, nameForLogging } = args;
  const url = getGithubDownloadUrl(version, filename);
  const response = await fetch(url);
  const contentLength = parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );
  let progressBar: ProgressBarInstance | null = null;
  if (!isNaN(contentLength) && contentLength !== 0 && process.stdout.isTTY) {
    progressBar = startLogProgress(
      `Downloading ${nameForLogging} [:bar] :percent :etas`,
      {
        width: 40,
        total: contentLength,
        clear: true,
      },
    );
  } else {
    logMessage(`Downloading ${nameForLogging}`);
  }
  if (response.status !== 200) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `File not found at ${url}.`,
    });
  }
  await withTmpDir(async (tmpDir) => {
    logVerbose(`Created tmp dir ${tmpDir.path}`);
    // Create a file in the tmp dir
    const zipLocation = tmpDir.registerTempPath(null);
    const readable = Readable.fromWeb(response.body! as any);
    await tmpDir.writeFileStream(zipLocation, readable, (chunk: any) => {
      if (progressBar !== null) {
        progressBar.tick(chunk.length);
      }
    });
    if (progressBar) {
      progressBar.terminate();
      logFinishedStep(`Downloaded ${nameForLogging}`);
    }
    logVerbose("Downloaded zip file");

    const zip = new AdmZip(zipLocation);
    await withTmpDir(async (versionDir) => {
      logVerbose(`Created tmp dir ${versionDir.path}`);
      zip.extractAllTo(versionDir.path, true);
      logVerbose("Extracted from zip file");
      await args.onDownloadComplete(ctx, versionDir.path);
    });
  });
  return executablePath(version);
}

export async function ensureDashboardDownloaded(ctx: Context, version: string) {
  const config = loadDashboardConfig(ctx);
  if (config !== null && config.version === version) {
    return;
  }
  await resetDashboardDir(ctx);
  await _ensureDashboardDownloaded(ctx, version);
}
async function _ensureDashboardDownloaded(ctx: Context, version: string) {
  const zipLocation = dashboardZip();
  if (ctx.fs.exists(zipLocation)) {
    ctx.fs.unlink(zipLocation);
  }
  const outDir = dashboardOutDir();
  await downloadZipFile(ctx, {
    version,
    filename: "dashboard.zip",
    nameForLogging: "Convex dashboard",
    onDownloadComplete: async (ctx, unzippedPath) => {
      await recursivelyCopy(ctx, nodeFs, unzippedPath, outDir);
      logVerbose("Copied into out dir");
    },
  });
  return outDir;
}
