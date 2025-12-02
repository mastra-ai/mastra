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
exports.readFileUtf8 = readFileUtf8;
exports.hasFSReadPermission = hasFSReadPermission;
exports.hashSHA1toHex = hashSHA1toHex;
exports.walk = walk;
exports.exists = exists;
exports.input = input;
const crypto = __importStar(require("node:crypto"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_process_1 = __importDefault(require("node:process"));
const readline = __importStar(require("node:readline"));
const node_stream_1 = require("node:stream");
async function readFileUtf8(...pathParts) {
    return await node_fs_1.promises.readFile(node_path_1.default.join(...pathParts), { encoding: "utf8" });
}
function hasFSReadPermission() {
    if (typeof Deno !== "undefined") {
        return Deno.permissions.querySync({ name: "read" }).state === "granted";
    }
    return true;
}
function hashSHA1toHex(msg) {
    return crypto.createHash("sha1").update(msg).digest("hex");
}
async function walk(dir, params) {
    const { match, skip = [] } = params || {};
    try {
        await node_fs_1.promises.access(dir);
    }
    catch (_err) {
        return [];
    }
    const dirents = await node_fs_1.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const fspath = node_path_1.default.resolve(dir, dirent.name);
        if (skip) {
            if (skip.some((re) => re.test(fspath))) {
                return [];
            }
        }
        if (dirent.isDirectory()) {
            return walk(fspath, params);
        }
        if (match) {
            if (!match.some((re) => re.test(fspath))) {
                return [];
            }
        }
        return [fspath];
    }));
    return Array.prototype.concat(...files);
}
async function exists(filepath) {
    try {
        await node_fs_1.promises.access(filepath);
        return true;
    }
    catch {
        return false;
    }
}
async function input(message, params) {
    let silent = false;
    const output = params?.silent
        ? new node_stream_1.Writable({
            write(chunk, encoding, callback) {
                if (!silent)
                    node_process_1.default.stdout.write(chunk, encoding);
                callback();
            },
        })
        : node_process_1.default.stdout;
    const rl = readline.createInterface({
        input: node_process_1.default.stdin,
        output,
    });
    return new Promise((resolve) => {
        rl.question(message, (val) => {
            rl.close();
            resolve(val);
        });
        silent = true;
    });
}
