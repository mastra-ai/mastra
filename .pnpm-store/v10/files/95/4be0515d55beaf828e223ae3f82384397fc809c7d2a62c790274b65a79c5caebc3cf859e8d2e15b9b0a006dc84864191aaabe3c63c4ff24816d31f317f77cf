"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWindows = void 0;
exports.searchConfigDir = searchConfigDir;
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const systemUtils_1 = require("./systemUtils");
exports.isWindows = process.platform === "win32";
const homeDir = node_os_1.default.homedir;
let _configDir;
if (process.platform === "darwin") {
    _configDir = () => {
        return node_path_1.default.join(homeDir(), "Library", "Application Support", "edgedb");
    };
}
else if (process.platform === "win32") {
    _configDir = () => {
        const localAppDataDir = process.env.LOCALAPPDATA ?? node_path_1.default.join(homeDir(), "AppData", "Local");
        return node_path_1.default.join(localAppDataDir, "EdgeDB", "config");
    };
}
else {
    _configDir = () => {
        let xdgConfigDir = process.env.XDG_CONFIG_HOME;
        if (!xdgConfigDir || !node_path_1.default.isAbsolute(xdgConfigDir)) {
            xdgConfigDir = node_path_1.default.join(homeDir(), ".config");
        }
        return node_path_1.default.join(xdgConfigDir, "edgedb");
    };
}
async function searchConfigDir(...configPath) {
    const filePath = node_path_1.default.join(_configDir(), ...configPath);
    if (await (0, systemUtils_1.exists)(filePath)) {
        return filePath;
    }
    const fallbackPath = node_path_1.default.join(homeDir(), ".edgedb", ...configPath);
    if (await (0, systemUtils_1.exists)(fallbackPath)) {
        return fallbackPath;
    }
    return filePath;
}
