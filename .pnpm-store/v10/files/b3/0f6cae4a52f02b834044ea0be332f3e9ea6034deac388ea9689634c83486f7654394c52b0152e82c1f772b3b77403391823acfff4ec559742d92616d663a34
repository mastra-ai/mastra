"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConnectArguments = exports.serverUtils = void 0;
exports.findStashPath = findStashPath;
const platform = __importStar(require("./platform"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const systemUtils_1 = require("./systemUtils");
const conUtils_1 = require("./conUtils");
const projectDirCache = new Map();
async function findProjectDir(required = true) {
    if (!required && !(0, systemUtils_1.hasFSReadPermission)()) {
        return null;
    }
    const workingDir = process.cwd();
    if (projectDirCache.has(workingDir)) {
        return projectDirCache.get(workingDir);
    }
    let dir = workingDir;
    const cwdDev = (await node_fs_1.promises.stat(dir)).dev;
    while (true) {
        if ((await (0, systemUtils_1.exists)(node_path_1.default.join(dir, "edgedb.toml"))) ||
            (await (0, systemUtils_1.exists)(node_path_1.default.join(dir, "gel.toml")))) {
            projectDirCache.set(workingDir, dir);
            return dir;
        }
        const parentDir = node_path_1.default.join(dir, "..");
        if (parentDir === dir || (await node_fs_1.promises.stat(parentDir)).dev !== cwdDev) {
            projectDirCache.set(workingDir, null);
            return null;
        }
        dir = parentDir;
    }
}
async function findStashPath(projectDir) {
    let projectPath = await node_fs_1.promises.realpath(projectDir);
    if (platform.isWindows && !projectPath.startsWith("\\\\")) {
        projectPath = "\\\\?\\" + projectPath;
    }
    const hash = (0, systemUtils_1.hashSHA1toHex)(projectPath);
    const baseName = node_path_1.default.basename(projectPath);
    const dirName = baseName + "-" + hash;
    return platform.searchConfigDir("projects", dirName);
}
exports.serverUtils = {
    findProjectDir,
    findStashPath,
    readFileUtf8: systemUtils_1.readFileUtf8,
    searchConfigDir: platform.searchConfigDir,
};
exports.parseConnectArguments = (0, conUtils_1.getConnectArgumentsParser)(exports.serverUtils);
