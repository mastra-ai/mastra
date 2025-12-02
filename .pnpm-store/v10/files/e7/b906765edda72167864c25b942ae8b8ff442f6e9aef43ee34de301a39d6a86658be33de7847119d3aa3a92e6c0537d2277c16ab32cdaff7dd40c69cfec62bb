"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findWorkspaces = exports.findWorkspacesRoot = exports.createWorkspacesCache = void 0;
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const node_fs_1 = require("node:fs");
const fast_glob_1 = require("fast-glob");
const yaml_1 = require("yaml");
function createWorkspacesCache() {
    return {
        root: new Map(),
        workspaces: new Map(),
        clear() {
            this.root.clear();
            this.workspaces.clear();
        },
    };
}
exports.createWorkspacesCache = createWorkspacesCache;
function findWorkspacesRoot(dirname, options = {}) {
    const dir = dirname ? (0, node_path_1.resolve)(dirname) : process.cwd();
    const stopDir = options.stopDir ? (0, node_path_1.resolve)(options.stopDir) : (0, node_os_1.homedir)();
    const cache = options.cache;
    if (cache) {
        for (const [key, value] of cache.root.entries()) {
            if ((dir + node_path_1.sep).startsWith(key + node_path_1.sep))
                return value;
        }
    }
    return findRoot(dir, stopDir, cache);
}
exports.findWorkspacesRoot = findWorkspacesRoot;
function findWorkspaces(dirname, options = {}) {
    var _a, _b;
    const root = findWorkspacesRoot(dirname, options);
    if (!root)
        return null;
    const cached = (_a = options.cache) === null || _a === void 0 ? void 0 : _a.workspaces.get(root.location);
    if (cached)
        return cached;
    const workspaces = (0, fast_glob_1.sync)(root.globs, {
        cwd: root.location,
        onlyDirectories: true,
        absolute: true,
        ignore: ["**/node_modules/**"],
    })
        .map((location) => ({
        location,
        package: resolveJSONFile(location, "package.json"),
    }))
        .filter((v) => isObject(v.package) && typeof v.package.name === "string");
    (_b = options.cache) === null || _b === void 0 ? void 0 : _b.workspaces.set(root.location, workspaces);
    return workspaces;
}
exports.findWorkspaces = findWorkspaces;
function findRoot(dir, stopDir, cache) {
    function memo(value) {
        cache === null || cache === void 0 ? void 0 : cache.root.set(dir, value);
        return value;
    }
    const globs = findGlobs(dir);
    if (globs)
        return memo({ location: dir.split(node_path_1.sep).join(node_path_1.posix.sep), globs });
    const next = (0, node_path_1.resolve)(dir, "..");
    if (next === stopDir || next === dir)
        return memo(null);
    return findRoot(next, stopDir, cache);
}
function findGlobs(dir) {
    const lernaGlobs = resolveLernaGlobs(dir);
    if (lernaGlobs)
        return lernaGlobs;
    const pnpmGlobs = resolvePnpmGlobs(dir);
    if (pnpmGlobs)
        return pnpmGlobs;
    return resolvePackageJsonGlobs(dir);
}
function resolveLernaGlobs(dir) {
    const lernaJson = resolveJSONFile(dir, "lerna.json");
    if (lernaJson === undefined)
        return null;
    if (isObject(lernaJson) && isStringArray(lernaJson.packages)) {
        return lernaJson.packages;
    }
    return null;
}
function resolvePnpmGlobs(dir) {
    const pnpmWorkspaceYaml = resolveYAMLFile(dir, "pnpm-workspace.yaml");
    if (pnpmWorkspaceYaml === undefined)
        return null;
    if (isObject(pnpmWorkspaceYaml) &&
        isStringArray(pnpmWorkspaceYaml.packages)) {
        return pnpmWorkspaceYaml.packages;
    }
    return ["**"];
}
function resolvePackageJsonGlobs(dir) {
    const packageJson = resolveJSONFile(dir, "package.json");
    if (packageJson === undefined)
        return null;
    if (isObject(packageJson)) {
        if (isStringArray(packageJson.workspaces))
            return packageJson.workspaces;
        if (isObject(packageJson.workspaces) &&
            isStringArray(packageJson.workspaces.packages)) {
            return packageJson.workspaces.packages;
        }
        if (isObject(packageJson.bolt) &&
            isStringArray(packageJson.bolt.workspaces)) {
            return packageJson.bolt.workspaces;
        }
    }
    return null;
}
function resolveJSONFile(dir, file) {
    const filePath = (0, node_path_1.join)(dir, file);
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(filePath).toString());
    }
    catch {
        return undefined;
    }
}
function resolveYAMLFile(dir, file) {
    const filePath = (0, node_path_1.join)(dir, file);
    try {
        return (0, yaml_1.parse)((0, node_fs_1.readFileSync)(filePath).toString());
    }
    catch {
        return undefined;
    }
}
function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function isStringArray(value) {
    if (!Array.isArray(value))
        return false;
    return value.every((item) => typeof item === "string");
}
