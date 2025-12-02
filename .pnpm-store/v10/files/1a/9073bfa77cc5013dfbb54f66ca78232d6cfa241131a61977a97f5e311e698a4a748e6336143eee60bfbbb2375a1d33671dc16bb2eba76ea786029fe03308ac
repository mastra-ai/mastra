var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// npm/lib/node-platform.ts
var import_os = __toESM(require("os"));
var import_path = __toESM(require("path"));
var knownPackages = {
  "darwin arm64 LE": "@cloudflare/workerd-darwin-arm64",
  "darwin x64 LE": "@cloudflare/workerd-darwin-64",
  "linux arm64 LE": "@cloudflare/workerd-linux-arm64",
  "linux x64 LE": "@cloudflare/workerd-linux-64",
  "win32 x64 LE": "@cloudflare/workerd-windows-64"
};
var maybeExeExtension = process.platform === "win32" ? ".exe" : "";
function pkgAndSubpathForCurrentPlatform() {
  let pkg;
  let subpath;
  let platformKey = `${process.platform} ${import_os.default.arch()} ${import_os.default.endianness()}`;
  if (platformKey in knownPackages) {
    pkg = knownPackages[platformKey];
    subpath = `bin/workerd${maybeExeExtension}`;
  } else {
    throw new Error(`Unsupported platform: ${platformKey}`);
  }
  return { pkg, subpath };
}
function downloadedBinPath(pkg, subpath) {
  const libDir = import_path.default.dirname(require.resolve("workerd"));
  return import_path.default.join(libDir, `downloaded-${pkg.replace("/", "-")}-${import_path.default.basename(subpath)}${maybeExeExtension}`);
}

// npm/lib/node-install.ts
var import_fs = __toESM(require("fs"));
var import_os2 = __toESM(require("os"));
var import_path2 = __toESM(require("path"));
var import_zlib = __toESM(require("zlib"));
var import_https = __toESM(require("https"));
var import_child_process = __toESM(require("child_process"));
var toPath = import_path2.default.join(__dirname, "bin", "workerd");
var isToPathJS = true;
function validateBinaryVersion(...command) {
  command.push("--version");
  let stdout;
  try {
    stdout = import_child_process.default.execFileSync(command.shift(), command, {
      // Without this, this install script strangely crashes with the error
      // "EACCES: permission denied, write" but only on Ubuntu Linux when node is
      // installed from the Snap Store. This is not a problem when you download
      // the official version of node. The problem appears to be that stderr
      // (i.e. file descriptor 2) isn't writable?
      //
      // More info:
      // - https://snapcraft.io/ (what the Snap Store is)
      // - https://nodejs.org/dist/ (download the official version of node)
      // - https://github.com/evanw/esbuild/issues/1711#issuecomment-1027554035
      //
      stdio: [
        /* stdin */
        "pipe",
        /* stdout */
        "pipe",
        /* stderr */
        "inherit"
      ]
    }).toString().trim();
  } catch (e) {
    let msg = `[workerd] Failed to validate workerd binary

Local development will not work. This usually means you're on an unsupported
operating system, or missing some shared libraries.`;
    if (process.platform === "linux") {
      msg += " On Debian-based systems,\nmake sure you've installed the `libc++1` package.";
    }
    console.error(msg);
    return;
  }
  if (stdout !== `workerd ${"2025-11-18"}`) {
    throw new Error(
      `Expected ${JSON.stringify(
        "2025-11-18"
      )} but got ${JSON.stringify(stdout)}`
    );
  }
}
function isYarn() {
  const { npm_config_user_agent } = process.env;
  if (npm_config_user_agent) {
    return /\byarn\//.test(npm_config_user_agent);
  }
  return false;
}
function fetch(url) {
  return new Promise((resolve, reject) => {
    import_https.default.get(url, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location)
        return fetch(res.headers.location).then(resolve, reject);
      if (res.statusCode !== 200)
        return reject(new Error(`Server responded with ${res.statusCode}`));
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}
function extractFileFromTarGzip(buffer, subpath) {
  try {
    buffer = import_zlib.default.unzipSync(buffer);
  } catch (err) {
    throw new Error(
      `Invalid gzip data in archive: ${err && err.message || err}`
    );
  }
  let str = (i, n) => String.fromCharCode(...buffer.subarray(i, i + n)).replace(/\0.*$/, "");
  let offset = 0;
  subpath = `package/${subpath}`;
  while (offset < buffer.length) {
    let name = str(offset, 100);
    let size = parseInt(str(offset + 124, 12), 8);
    offset += 512;
    if (!isNaN(size)) {
      if (name === subpath) return buffer.subarray(offset, offset + size);
      offset += size + 511 & ~511;
    }
  }
  throw new Error(`Could not find ${JSON.stringify(subpath)} in archive`);
}
function installUsingNPM(pkg, subpath, binPath) {
  const env = { ...process.env, npm_config_global: void 0 };
  const libDir = import_path2.default.dirname(require.resolve("workerd"));
  const installDir = import_path2.default.join(libDir, "npm-install");
  import_fs.default.mkdirSync(installDir);
  try {
    import_fs.default.writeFileSync(import_path2.default.join(installDir, "package.json"), "{}");
    import_child_process.default.execSync(
      `npm install --loglevel=error --prefer-offline --no-audit --progress=false ${pkg}@${"1.20251118.0"}`,
      { cwd: installDir, stdio: "pipe", env }
    );
    const installedBinPath = import_path2.default.join(
      installDir,
      "node_modules",
      pkg,
      subpath
    );
    import_fs.default.renameSync(installedBinPath, binPath);
  } finally {
    try {
      removeRecursive(installDir);
    } catch {
    }
  }
}
function removeRecursive(dir) {
  for (const entry of import_fs.default.readdirSync(dir)) {
    const entryPath = import_path2.default.join(dir, entry);
    let stats;
    try {
      stats = import_fs.default.lstatSync(entryPath);
    } catch {
      continue;
    }
    if (stats.isDirectory()) removeRecursive(entryPath);
    else import_fs.default.unlinkSync(entryPath);
  }
  import_fs.default.rmdirSync(dir);
}
function maybeOptimizePackage(binPath) {
  if (import_os2.default.platform() !== "win32" && !isYarn()) {
    const tempPath = import_path2.default.join(__dirname, "bin-workerd");
    try {
      import_fs.default.linkSync(binPath, tempPath);
      import_fs.default.renameSync(tempPath, toPath);
      isToPathJS = false;
      import_fs.default.unlinkSync(tempPath);
    } catch {
    }
  }
}
async function downloadDirectlyFromNPM(pkg, subpath, binPath) {
  const unscopedPkg = pkg.substring(pkg.indexOf("/") + 1);
  const url = `https://registry.npmjs.org/${pkg}/-/${unscopedPkg}-${"1.20251118.0"}.tgz`;
  console.error(`[workerd] Trying to download ${JSON.stringify(url)}`);
  try {
    import_fs.default.writeFileSync(
      binPath,
      extractFileFromTarGzip(await fetch(url), subpath)
    );
    import_fs.default.chmodSync(binPath, 493);
  } catch (e) {
    console.error(
      `[workerd] Failed to download ${JSON.stringify(url)}: ${e && e.message || e}`
    );
    throw e;
  }
}
async function checkAndPreparePackage() {
  const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
  let binPath;
  try {
    binPath = require.resolve(`${pkg}/${subpath}`);
  } catch (e) {
    console.error(`[workerd] Failed to find package "${pkg}" on the file system

This can happen if you use the "--no-optional" flag. The "optionalDependencies"
package.json feature is used by workerd to install the correct binary executable
for your current platform. This install script will now attempt to work around
this. If that fails, you need to remove the "--no-optional" flag to use workerd.
`);
    binPath = downloadedBinPath(pkg, subpath);
    try {
      console.error(`[workerd] Trying to install package "${pkg}" using npm`);
      installUsingNPM(pkg, subpath, binPath);
    } catch (e2) {
      console.error(
        `[workerd] Failed to install package "${pkg}" using npm: ${e2 && e2.message || e2}`
      );
      try {
        await downloadDirectlyFromNPM(pkg, subpath, binPath);
      } catch (e3) {
        throw new Error(`Failed to install package "${pkg}"`);
      }
    }
  }
  maybeOptimizePackage(binPath);
}
checkAndPreparePackage().then(() => {
  if (isToPathJS) {
    validateBinaryVersion(process.execPath, toPath);
  } else {
    validateBinaryVersion(toPath);
  }
});
