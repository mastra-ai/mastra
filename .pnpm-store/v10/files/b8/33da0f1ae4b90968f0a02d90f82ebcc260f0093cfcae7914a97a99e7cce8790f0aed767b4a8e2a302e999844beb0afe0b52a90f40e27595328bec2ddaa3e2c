#!/usr/bin/env node
import { execSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as process from "node:process";
import envPaths from "env-paths";
import Debug from "debug";
import which from "which";
import { quote } from "shell-quote";
const debug = Debug("gel:cli");
const IS_TTY = process.stdout.isTTY;
const SCRIPT_LOCATION = await fs.realpath(fileURLToPath(import.meta.url));
const EDGEDB_PKG_ROOT = "https://packages.edgedb.com";
const CACHE_DIR = envPaths("gel", { suffix: "" }).cache;
const CACHED_CLI_PATH = path.join(CACHE_DIR, "/bin/gel");
const SCRIPT_NAME = import.meta.url.split("/").pop() || "gel";
debug("Process argv:", process.argv);
let args = process.argv.slice(2);
if (args[0] === SCRIPT_NAME) {
    args = args.slice(1);
}
await main(args);
async function main(args) {
    debug(`Running CLI wrapper from: ${fileURLToPath(import.meta.url)}`);
    debug("Starting main function with args:", args);
    debug(`  - IS_TTY: ${IS_TTY}`);
    debug(`  - SCRIPT_LOCATION: ${SCRIPT_LOCATION}`);
    debug(`  - EDGEDB_PKG_ROOT: ${EDGEDB_PKG_ROOT}`);
    debug(`  - CACHE_DIR: ${CACHE_DIR}`);
    debug(`  - CACHED_CLI_PATH: ${CACHED_CLI_PATH}`);
    if (args.length === 1 && args[0] === "--succeed-if-cli-bin-wrapper") {
        process.exit(0);
    }
    const cliLocation = (await whichGelCli()) ??
        (await getCliLocationFromCachedCli()) ??
        (await getCachedCliLocation()) ??
        null;
    if (cliLocation === null) {
        throw Error("Failed to find or install Gel CLI.");
    }
    try {
        runCli(args, cliLocation);
    }
    catch (err) {
        if (typeof err === "object" &&
            err !== null &&
            "status" in err &&
            typeof err.status === "number") {
            process.exit(err.status);
        }
        else {
            console.error(err);
        }
        process.exit(1);
    }
    process.exit(0);
}
async function whichGelCli() {
    debug("Checking if CLI is in PATH...");
    const locations = (await which(SCRIPT_NAME, { nothrow: true, all: true })) || [];
    for (const location of locations) {
        const actualLocation = await fs.realpath(location);
        debug(`  - CLI found in PATH at: ${location} (resolved to: ${actualLocation})`);
        if (actualLocation === SCRIPT_LOCATION) {
            debug("  - CLI found in PATH is the current script. Ignoring.");
            continue;
        }
        const lowerCaseLocation = actualLocation.toLowerCase();
        if (lowerCaseLocation.endsWith(".cmd") ||
            lowerCaseLocation.endsWith(".ps1")) {
            debug("  - CLI found in PATH is a Windows script. Ignoring.");
            continue;
        }
        if (lowerCaseLocation.includes("node_modules/.bin")) {
            debug("  - CLI found in PATH is in a node_modules/.bin directory. Ignoring.");
            continue;
        }
        try {
            runCli(["--succeed-if-cli-bin-wrapper"], actualLocation, {
                stdio: "ignore",
            });
            debug("  - CLI found in PATH is wrapper script. Ignoring.");
            continue;
        }
        catch (_err) {
            debug("  - CLI found in PATH is not a wrapper script. Using.");
        }
        return location;
    }
    debug("  - No CLI found in PATH.");
    return null;
}
async function getCachedCliLocation() {
    try {
        const stats = await fs.stat(CACHED_CLI_PATH);
        if (!stats.isFile()) {
            debug("  - Object found at cached CLI path is not a file. Downloading...");
            await downloadCliPackage();
        }
    }
    catch (_err) {
        debug("  - No cached CLI found. Downloading...");
        await downloadCliPackage();
    }
    await fs.access(CACHED_CLI_PATH, fs.constants.F_OK);
    return CACHED_CLI_PATH;
}
async function getCliLocationFromCachedCli() {
    debug("Installing temporary CLI to get install directory...");
    const cachedCliLocation = await getCachedCliLocation();
    const installDir = getInstallDir(cachedCliLocation);
    const binaryPath = path.join(installDir, "gel");
    debug("  - CLI installed at:", binaryPath);
    try {
        debug("  - CLI binary found in path:", binaryPath);
        await fs.access(binaryPath, fs.constants.F_OK);
        return binaryPath;
    }
    catch {
        debug("  - CLI binary not found in path:", binaryPath);
        return null;
    }
}
async function downloadCliPackage() {
    debug("Downloading CLI package...");
    const cliPkgUrl = await findPackageUrl();
    const downloadDir = path.dirname(CACHED_CLI_PATH);
    await fs.mkdir(downloadDir, { recursive: true }).catch((error) => {
        if (error.code !== "EEXIST")
            throw error;
    });
    await downloadFile(cliPkgUrl, CACHED_CLI_PATH);
    debug("  - CLI package downloaded to:", CACHED_CLI_PATH);
    const fd = await fs.open(CACHED_CLI_PATH, "r+");
    await fd.chmod(0o755);
    await fd.datasync();
    await fd.close();
}
function runCli(args, pathToCli, execOptions = { stdio: "inherit" }) {
    const command = quote([pathToCli, ...args]);
    debug(`Running Gel CLI: ${command}`);
    return execSync(command, execOptions);
}
async function findPackageUrl() {
    const arch = os.arch();
    const platform = os.platform();
    debug("Getting base distribution for:", platform, arch);
    let dist = "";
    let ext = "";
    if (arch === "x64") {
        dist += "x86_64";
    }
    else if (arch === "arm64") {
        dist += "aarch64";
    }
    else {
        throw new Error(`Unsupported architecture: ${arch}`);
    }
    if (platform === "win32") {
        dist += "-pc-windows-msvc";
        ext = ".exe";
    }
    else if (platform === "darwin") {
        dist += "-apple-darwin";
    }
    else if (platform === "linux") {
        dist += "-unknown-linux-musl";
    }
    else {
        throw new Error(`Unsupported OS: ${platform}`);
    }
    const pkg = new URL(`/dist/${dist}/gel-cli${ext}`, EDGEDB_PKG_ROOT);
    debug("  - Package URL:", pkg.href);
    return pkg;
}
async function downloadFile(url, path) {
    debug("Downloading file from URL:", url);
    const response = await fetch(url);
    if (!response.ok || !response.body) {
        throw new Error(`Download from ${url} failed: ${response.statusText}`);
    }
    const fileStream = createWriteStream(path, { flush: true });
    if (response.body) {
        for await (const chunk of streamReader(response.body)) {
            fileStream.write(chunk);
        }
        fileStream.end();
        debug("  - File downloaded successfully.");
    }
    else {
        throw new Error("  - Download failed: no response body");
    }
}
function getInstallDir(cliPath) {
    debug("Getting install directory for CLI path:", cliPath);
    const installDir = runCli(["info", "--get", "install-dir"], cliPath, {
        stdio: "pipe",
    })
        .toString()
        .trim();
    debug("  - Install directory:", installDir);
    return installDir;
}
async function* streamReader(readableStream) {
    debug("Reading stream...");
    const reader = readableStream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        yield value;
    }
    debug("  - Stream reading completed.");
}
