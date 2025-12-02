"use strict";
import AdmZip from "adm-zip";
import {
  logFinishedStep,
  startLogProgress,
  logVerbose,
  logMessage,
  logError,
  logWarning
} from "../../../bundler/log.js";
import {
  dashboardZip,
  executablePath,
  versionedBinaryDir,
  dashboardOutDir,
  resetDashboardDir,
  loadDashboardConfig,
  executableName
} from "./filePaths.js";
import child_process from "child_process";
import { promisify } from "util";
import { Readable } from "stream";
import { nodeFs, withTmpDir } from "../../../bundler/fs.js";
import { recursivelyDelete, recursivelyCopy } from "../fsUtils.js";
import { LocalDeploymentError } from "./errors.js";
import path from "path";
async function makeExecutable(p) {
  switch (process.platform) {
    case "darwin":
    case "linux": {
      await promisify(child_process.exec)(`chmod +x ${p}`);
    }
  }
}
export async function ensureBackendBinaryDownloaded(ctx, version) {
  if (version.kind === "version") {
    return _ensureBackendBinaryDownloaded(ctx, version.version);
  }
  if (version.allowedVersion) {
    const latestVersionWithBinary2 = await findLatestVersionWithBinary(
      ctx,
      false
    );
    if (latestVersionWithBinary2 === null) {
      logWarning(
        `Failed to get latest version from GitHub, using downloaded version ${version.allowedVersion}`
      );
      return _ensureBackendBinaryDownloaded(ctx, version.allowedVersion);
    }
    return _ensureBackendBinaryDownloaded(ctx, latestVersionWithBinary2);
  }
  const latestVersionWithBinary = await findLatestVersionWithBinary(ctx, true);
  return _ensureBackendBinaryDownloaded(ctx, latestVersionWithBinary);
}
async function _ensureBackendBinaryDownloaded(ctx, version) {
  logVerbose(`Ensuring backend binary downloaded for version ${version}`);
  const existingDownload = await checkForExistingDownload(ctx, version);
  if (existingDownload !== null) {
    logVerbose(`Using existing download at ${existingDownload}`);
    return {
      binaryPath: existingDownload,
      version
    };
  }
  const binaryPath = await downloadBackendBinary(ctx, version);
  return { version, binaryPath };
}
function parseLinkHeader(header) {
  const links = {};
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
export async function findLatestVersionWithBinary(ctx, requireSuccess) {
  async function maybeCrash(...args) {
    if (requireSuccess) {
      return await ctx.crash(...args);
    }
    if (args[0].printedMessage) {
      logError(args[0].printedMessage);
    } else {
      logError("Error downloading latest binary");
    }
    return null;
  }
  const targetName = getDownloadPath();
  logVerbose(
    `Finding latest stable release containing binary named ${targetName}`
  );
  let latestVersion;
  let nextUrl = "https://api.github.com/repos/get-convex/convex-backend/releases?per_page=30";
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
            `GitHub API returned ${response.status}: ${text}`
          )
        });
      }
      const releases = await response.json();
      if (releases.length === 0) {
        break;
      }
      for (const release of releases) {
        if (!latestVersion && !release.prerelease && !release.draft) {
          latestVersion = release.tag_name;
          logVerbose(`Latest stable version is ${latestVersion}`);
        }
        if (!release.prerelease && !release.draft) {
          if (release.assets.find((asset) => asset.name === targetName)) {
            logVerbose(
              `Latest stable version with appropriate binary is ${release.tag_name}`
            );
            return release.tag_name;
          }
          logVerbose(
            `Version ${release.tag_name} does not contain a ${targetName}, checking previous version`
          );
        }
      }
      const linkHeader = response.headers.get("Link");
      if (!linkHeader) {
        break;
      }
      const links = parseLinkHeader(linkHeader);
      nextUrl = links["next"] || "";
    }
    if (!latestVersion) {
      return await maybeCrash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Found no non-draft, non-prerelease convex backend releases.",
        errForSentry: new LocalDeploymentError(
          "Found no non-draft, non-prerelease convex backend releases."
        )
      });
    }
    const message = `Failed to find a convex backend release that contained ${targetName}.`;
    return await maybeCrash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new LocalDeploymentError(message)
    });
  } catch (e) {
    return maybeCrash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to get latest convex backend releases",
      errForSentry: new LocalDeploymentError(e?.toString())
    });
  }
}
async function checkForExistingDownload(ctx, version) {
  const destDir = versionedBinaryDir(version);
  if (!ctx.fs.exists(destDir)) {
    return null;
  }
  const p = executablePath(version);
  if (!ctx.fs.exists(p)) {
    recursivelyDelete(ctx, destDir, { force: true });
    return null;
  }
  await makeExecutable(p);
  return p;
}
async function downloadBackendBinary(ctx, version) {
  const downloadPath = getDownloadPath();
  if (downloadPath === null) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Unsupported platform ${process.platform} and architecture ${process.arch} for local deployment.`
    });
  }
  await downloadZipFile(ctx, {
    version,
    filename: downloadPath,
    nameForLogging: "Convex backend binary",
    onDownloadComplete: async (ctx2, unzippedPath) => {
      const name = executableName();
      const tempExecPath = path.join(unzippedPath, name);
      await makeExecutable(tempExecPath);
      logVerbose("Marked as executable");
      ctx2.fs.mkdir(versionedBinaryDir(version), { recursive: true });
      ctx2.fs.swapTmpFile(tempExecPath, executablePath(version));
    }
  });
  return executablePath(version);
}
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
function getGithubDownloadUrl(version, filename) {
  return `https://github.com/get-convex/convex-backend/releases/download/${version}/${filename}`;
}
async function downloadZipFile(ctx, args) {
  const { version, filename, nameForLogging } = args;
  const url = getGithubDownloadUrl(version, filename);
  const response = await fetch(url);
  const contentLength = parseInt(
    response.headers.get("content-length") ?? "",
    10
  );
  let progressBar = null;
  if (!isNaN(contentLength) && contentLength !== 0 && process.stdout.isTTY) {
    progressBar = startLogProgress(
      `Downloading ${nameForLogging} [:bar] :percent :etas`,
      {
        width: 40,
        total: contentLength,
        clear: true
      }
    );
  } else {
    logMessage(`Downloading ${nameForLogging}`);
  }
  if (response.status !== 200) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `File not found at ${url}.`
    });
  }
  await withTmpDir(async (tmpDir) => {
    logVerbose(`Created tmp dir ${tmpDir.path}`);
    const zipLocation = tmpDir.registerTempPath(null);
    const readable = Readable.fromWeb(response.body);
    await tmpDir.writeFileStream(zipLocation, readable, (chunk) => {
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
export async function ensureDashboardDownloaded(ctx, version) {
  const config = loadDashboardConfig(ctx);
  if (config !== null && config.version === version) {
    return;
  }
  await resetDashboardDir(ctx);
  await _ensureDashboardDownloaded(ctx, version);
}
async function _ensureDashboardDownloaded(ctx, version) {
  const zipLocation = dashboardZip();
  if (ctx.fs.exists(zipLocation)) {
    ctx.fs.unlink(zipLocation);
  }
  const outDir = dashboardOutDir();
  await downloadZipFile(ctx, {
    version,
    filename: "dashboard.zip",
    nameForLogging: "Convex dashboard",
    onDownloadComplete: async (ctx2, unzippedPath) => {
      await recursivelyCopy(ctx2, nodeFs, unzippedPath, outDir);
      logVerbose("Copied into out dir");
    }
  });
  return outDir;
}
//# sourceMappingURL=download.js.map
