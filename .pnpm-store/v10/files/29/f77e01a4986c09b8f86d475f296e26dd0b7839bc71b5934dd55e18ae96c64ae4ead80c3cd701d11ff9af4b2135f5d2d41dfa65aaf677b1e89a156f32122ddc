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
var globalConfig_exports = {};
__export(globalConfig_exports, {
  formatPathForPrinting: () => formatPathForPrinting,
  globalConfigPath: () => globalConfigPath,
  modifyGlobalConfig: () => modifyGlobalConfig,
  readGlobalConfig: () => readGlobalConfig
});
module.exports = __toCommonJS(globalConfig_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_os = __toESM(require("os"), 1);
var import_path = __toESM(require("path"), 1);
var import_utils = require("./utils.js");
var import_log = require("../../../bundler/log.js");
var import_zod = require("zod");
function globalConfigPath() {
  return import_path.default.join((0, import_utils.rootDirectory)(), "config.json");
}
const schema = import_zod.z.object({
  accessToken: import_zod.z.string().min(1),
  optOutOfLocalDevDeploymentsUntilBetaOver: import_zod.z.boolean().optional()
});
function readGlobalConfig(ctx) {
  const configPath = globalConfigPath();
  let configFile;
  try {
    configFile = ctx.fs.readUtf8File(configPath);
  } catch {
    return null;
  }
  try {
    const storedConfig = JSON.parse(configFile);
    const config = schema.parse(storedConfig);
    return config;
  } catch (err) {
    (0, import_log.logError)(
      import_chalk.default.red(
        `Failed to parse global config in ${configPath} with error ${err}.`
      )
    );
    return null;
  }
}
async function modifyGlobalConfig(ctx, config) {
  const configPath = globalConfigPath();
  let configFile;
  try {
    configFile = ctx.fs.readUtf8File(configPath);
  } catch {
  }
  let storedConfig = {};
  if (configFile) {
    try {
      storedConfig = JSON.parse(configFile);
      schema.parse(storedConfig);
    } catch (err) {
      (0, import_log.logError)(
        import_chalk.default.red(
          `Failed to parse global config in ${configPath} with error ${err}.`
        )
      );
      storedConfig = {};
    }
  }
  const newConfig = { ...storedConfig, ...config };
  await overrwriteGlobalConfig(ctx, newConfig);
}
async function overrwriteGlobalConfig(ctx, config) {
  const dirName = (0, import_utils.rootDirectory)();
  ctx.fs.mkdir(dirName, { allowExisting: true });
  const path2 = globalConfigPath();
  try {
    ctx.fs.writeUtf8File(path2, JSON.stringify(config, null, 2));
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: import_chalk.default.red(
        `Failed to write auth config to ${path2} with error: ${err}`
      )
    });
  }
  (0, import_log.logVerbose)(`Saved credentials to ${formatPathForPrinting(path2)}`);
}
function formatPathForPrinting(path2) {
  const homedir = import_os.default.homedir();
  if (process.platform === "darwin" && path2.startsWith(homedir)) {
    return path2.replace(homedir, "~");
  }
  return path2;
}
//# sourceMappingURL=globalConfig.js.map
