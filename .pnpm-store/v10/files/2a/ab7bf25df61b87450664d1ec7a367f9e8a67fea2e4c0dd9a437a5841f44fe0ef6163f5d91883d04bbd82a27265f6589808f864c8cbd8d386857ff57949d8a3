"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var download_exports = {};
__export(download_exports, {
  ensureBackendBinaryDownloaded: () => ensureBackendBinaryDownloaded,
  ensureDashboardDownloaded: () => ensureDashboardDownloaded,
  findLatestVersionWithBinary: () => findLatestVersionWithBinary
});
module.exports = __toCommonJS(download_exports);
var import_adm_zip = __toESM(require("adm-zip"), 1);
var import_log = require("../../../bundler/log.js");
var import_filePaths = require("./filePaths.js");
var import_child_process = __toESM(require("child_process"), 1);
var import_util = require("util");
var import_stream = require("stream");
var import_fs = require("../../../bundler/fs.js");
var import_fsUtils = require("../fsUtils.js");
var import_errors = require("./errors.js");
var import_path = __toESM(require("path"), 1);
async function makeExecutable(p) {
  switch (process.platform) {
    case "darwin":
    case "linux": {
      await (0, import_util.promisify)(import_child_process.default.exec)(`chmod +x ${p}`);
    }
  }
}
async function ensureBackendBinaryDownloaded(ctx, version) {
  if (version.kind === "version") {
    return _ensureBackendBinaryDownloaded(ctx, version.version);
  }
  if (version.allowedVersion) {
    const latestVersionWithBinary2 = await findLatestVersionWithBinary(
      ctx,
      false
    );
    if (latestVersionWithBinary2 === null) {
      (0, import_log.logWarning)(
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
  (0, import_log.logVerbose)(`Ensuring backend binary downloaded for version ${version}`);
  const existingDownload = await checkForExistingDownload(ctx, version);
  if (existingDownload !== null) {
    (0, import_log.logVerbose)(`Using existing download at ${existingDownload}`);
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
async function findLatestVersionWithBinary(ctx, requireSuccess) {
  async function maybeCrash(...args) {
    if (requireSuccess) {
      return await ctx.crash(...args);
    }
    if (args[0].printedMessage) {
      (0, import_log.logError)(args[0].printedMessage);
    } else {
      (0, import_log.logError)("Error downloading latest binary");
    }
    return null;
  }
  const targetName = getDownloadPath();
  (0, import_log.logVerbose)(
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
          errForSentry: new import_errors.LocalDeploymentError(
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
          (0, import_log.logVerbose)(`Latest stable version is ${latestVersion}`);
        }
        if (!release.prerelease && !release.draft) {
          if (release.assets.find((asset) => asset.name === targetName)) {
            (0, import_log.logVerbose)(
              `Latest stable version with appropriate binary is ${release.tag_name}`
            );
            return release.tag_name;
          }
          (0, import_log.logVerbose)(
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
        errForSentry: new import_errors.LocalDeploymentError(
          "Found no non-draft, non-prerelease convex backend releases."
        )
      });
    }
    const message = `Failed to find a convex backend release that contained ${targetName}.`;
    return await maybeCrash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: message,
      errForSentry: new import_errors.LocalDeploymentError(message)
    });
  } catch (e) {
    return maybeCrash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Failed to get latest convex backend releases",
      errForSentry: new import_errors.LocalDeploymentError(e?.toString())
    });
  }
}
async function checkForExistingDownload(ctx, version) {
  const destDir = (0, import_filePaths.versionedBinaryDir)(version);
  if (!ctx.fs.exists(destDir)) {
    return null;
  }
  const p = (0, import_filePaths.executablePath)(version);
  if (!ctx.fs.exists(p)) {
    (0, import_fsUtils.recursivelyDelete)(ctx, destDir, { force: true });
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
      const name = (0, import_filePaths.executableName)();
      const tempExecPath = import_path.default.join(unzippedPath, name);
      await makeExecutable(tempExecPath);
      (0, import_log.logVerbose)("Marked as executable");
      ctx2.fs.mkdir((0, import_filePaths.versionedBinaryDir)(version), { recursive: true });
      ctx2.fs.swapTmpFile(tempExecPath, (0, import_filePaths.executablePath)(version));
    }
  });
  return (0, import_filePaths.executablePath)(version);
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
    progressBar = (0, import_log.startLogProgress)(
      `Downloading ${nameForLogging} [:bar] :percent :etas`,
      {
        width: 40,
        total: contentLength,
        clear: true
      }
    );
  } else {
    (0, import_log.logMessage)(`Downloading ${nameForLogging}`);
  }
  if (response.status !== 200) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `File not found at ${url}.`
    });
  }
  await (0, import_fs.withTmpDir)(async (tmpDir) => {
    (0, import_log.logVerbose)(`Created tmp dir ${tmpDir.path}`);
    const zipLocation = tmpDir.registerTempPath(null);
    const readable = import_stream.Readable.fromWeb(response.body);
    await tmpDir.writeFileStream(zipLocation, readable, (chunk) => {
      if (progressBar !== null) {
        progressBar.tick(chunk.length);
      }
    });
    if (progressBar) {
      progressBar.terminate();
      (0, import_log.logFinishedStep)(`Downloaded ${nameForLogging}`);
    }
    (0, import_log.logVerbose)("Downloaded zip file");
    const zip = new import_adm_zip.default(zipLocation);
    await (0, import_fs.withTmpDir)(async (versionDir) => {
      (0, import_log.logVerbose)(`Created tmp dir ${versionDir.path}`);
      zip.extractAllTo(versionDir.path, true);
      (0, import_log.logVerbose)("Extracted from zip file");
      await args.onDownloadComplete(ctx, versionDir.path);
    });
  });
  return (0, import_filePaths.executablePath)(version);
}
async function ensureDashboardDownloaded(ctx, version) {
  const config = (0, import_filePaths.loadDashboardConfig)(ctx);
  if (config !== null && config.version === version) {
    return;
  }
  await (0, import_filePaths.resetDashboardDir)(ctx);
  await _ensureDashboardDownloaded(ctx, version);
}
async function _ensureDashboardDownloaded(ctx, version) {
  const zipLocation = (0, import_filePaths.dashboardZip)();
  if (ctx.fs.exists(zipLocation)) {
    ctx.fs.unlink(zipLocation);
  }
  const outDir = (0, import_filePaths.dashboardOutDir)();
  await downloadZipFile(ctx, {
    version,
    filename: "dashboard.zip",
    nameForLogging: "Convex dashboard",
    onDownloadComplete: async (ctx2, unzippedPath) => {
      await (0, import_fsUtils.recursivelyCopy)(ctx2, import_fs.nodeFs, unzippedPath, outDir);
      (0, import_log.logVerbose)("Copied into out dir");
    }
  });
  return outDir;
}
//# sourceMappingURL=download.js.map
