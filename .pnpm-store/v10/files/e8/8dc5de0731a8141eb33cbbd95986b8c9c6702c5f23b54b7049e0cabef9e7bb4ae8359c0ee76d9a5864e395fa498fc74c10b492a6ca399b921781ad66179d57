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
var docs_exports = {};
__export(docs_exports, {
  docs: () => docs
});
module.exports = __toCommonJS(docs_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = __toESM(require("chalk"), 1);
var import_open = __toESM(require("open"), 1);
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_utils = require("./lib/utils/utils.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const docs = new import_extra_typings.Command("docs").description("Open the docs in the browser").allowExcessArguments(false).option("--no-open", "Print docs URL instead of opening it in your browser").action(async (options) => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const configuredDeployment = (0, import_deploymentSelection.deploymentNameFromSelection)(deploymentSelection);
  if (configuredDeployment === null) {
    await openDocs(ctx, options.open);
    return;
  }
  const getCookieUrl = `get_cookie/${configuredDeployment}`;
  const fetch = await (0, import_utils.bigBrainFetch)(ctx);
  try {
    const res = await fetch(getCookieUrl);
    (0, import_utils.deprecationCheckWarning)(ctx, res);
    const { cookie } = await res.json();
    await openDocs(ctx, options.open, cookie);
  } catch {
    await openDocs(ctx, options.open);
  }
});
async function openDocs(ctx, toOpen, cookie) {
  let docsUrl = "https://docs.convex.dev";
  if (cookie !== void 0) {
    docsUrl += "/?t=" + cookie;
  }
  if (toOpen) {
    await (0, import_open.default)(docsUrl);
    (0, import_log.logMessage)(import_chalk.default.green("Docs have launched! Check your browser."));
  } else {
    (0, import_log.logMessage)(import_chalk.default.green(`Find Convex docs here: ${docsUrl}`));
  }
}
//# sourceMappingURL=docs.js.map
