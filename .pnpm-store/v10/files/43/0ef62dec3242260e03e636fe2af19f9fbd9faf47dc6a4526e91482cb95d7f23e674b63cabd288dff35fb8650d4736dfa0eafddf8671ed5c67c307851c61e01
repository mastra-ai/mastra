#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adm_zip_1 = __importDefault(require("adm-zip"));
const debug_1 = __importDefault(require("debug"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const path_1 = __importDefault(require("path"));
const tar_1 = __importDefault(require("tar"));
const url_1 = require("url");
const package_json_1 = __importDefault(require("./package.json"));
const rootDebug = (0, debug_1.default)("inngest:cli");
const archMap = {
    arm64: "arm64",
    x64: "amd64",
};
var KnownExtension;
(function (KnownExtension) {
    KnownExtension["Tar"] = ".tar.gz";
    KnownExtension["Zip"] = ".zip";
})(KnownExtension || (KnownExtension = {}));
const platformMap = {
    linux: { platform: "linux", extension: KnownExtension.Tar },
    darwin: { platform: "darwin", extension: KnownExtension.Tar },
    win32: { platform: "windows", extension: KnownExtension.Zip },
};
function getBinaryUrl() {
    return __awaiter(this, void 0, void 0, function* () {
        const debug = rootDebug.extend("getBinaryUrl");
        const { arch, platform } = getArchPlatform();
        debug({ arch, platform });
        let version = package_json_1.default.version.trim();
        debug("package.json version:", version);
        const targetUrl = new url_1.URL(`https://cli.inngest.com/artifact/v${version}/inngest_${version}_${platform.platform}_${arch}${platform.extension}`);
        debug("targetUrl:", targetUrl.href);
        return targetUrl;
    });
}
function getArchPlatform() {
    const debug = rootDebug.extend("getArchPlatform");
    const arch = archMap[process.arch];
    const platform = platformMap[process.platform];
    debug({
        arch,
        platform,
        "process.arch": process.arch,
        "process.platform": process.platform,
    });
    if (!arch) {
        throw new Error(`Unsupported architecture: ${process.arch}`);
    }
    if (!platform) {
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
    return { arch, platform };
}
function downloadBinary(url) {
    const debug = rootDebug.extend("downloadBinary");
    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        debug("downloading binary from:", url.href);
        (0, node_fetch_1.default)(url.href, {
            redirect: "follow",
        })
            .then((res) => {
            if (res.status !== 200) {
                throw new Error(`Error downloading binary; invalid response status code: ${res.status}`);
            }
            resolve(res);
        })
            .catch(reject);
    }));
}
function pipeBinaryToInstallLocation(res, originalUrl) {
    const debug = rootDebug.extend("pipeBinaryToInstallLocation");
    return new Promise((resolve, reject) => {
        if (!res.body) {
            return reject(new Error("No body to pipe"));
        }
        const targetPath = path_1.default.resolve("./bin");
        debug("targetPath:", targetPath);
        const strategies = {
            [KnownExtension.Tar]: () => {
                var _a;
                debug("unpacking using tar strategy");
                const untar = tar_1.default.extract({ cwd: targetPath });
                untar.on("error", reject);
                untar.on("end", () => resolve());
                (_a = res.body) === null || _a === void 0 ? void 0 : _a.pipe(untar);
            },
            [KnownExtension.Zip]: () => {
                debug("unpacking using zip strategy");
                res
                    .buffer()
                    .then((buffer) => {
                    const zip = new adm_zip_1.default(buffer);
                    zip.extractAllTo(targetPath, true);
                    resolve();
                })
                    .catch(reject);
            },
        };
        const [, strategy] = Object.entries(strategies).find(([knownExt]) => {
            return originalUrl.pathname.endsWith(knownExt);
        }) || [, null];
        if (!strategy) {
            return reject(new Error("Unsupported extension"));
        }
        strategy();
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    rootDebug("postinstall started");
    if (process.env.SKIP_POSTINSTALL) {
        rootDebug("SKIP_POSTINSTALL was defined; skipping postinstall");
        process.exit(0);
    }
    try {
        const binaryUrl = yield getBinaryUrl();
        const req = yield downloadBinary(binaryUrl);
        yield pipeBinaryToInstallLocation(req, binaryUrl);
        rootDebug("postinstall complete");
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}))();
