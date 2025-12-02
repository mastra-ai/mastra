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
var browserBackend_exports = {};
__export(browserBackend_exports, {
  runBrowserBackendAtEnd: () => runBrowserBackendAtEnd
});
module.exports = __toCommonJS(browserBackend_exports);
var mcp = __toESM(require("../sdk/exports"));
var import_globals = require("../../common/globals");
var import_util = require("../../util");
var import_config = require("../browser/config");
var import_browserServerBackend = require("../browser/browserServerBackend");
var import_tab = require("../browser/tab");
async function runBrowserBackendAtEnd(context, errorMessage) {
  const testInfo = (0, import_globals.currentTestInfo)();
  if (!testInfo)
    return;
  const shouldPause = errorMessage ? testInfo?._pauseOnError() : testInfo?._pauseAtEnd();
  if (!shouldPause)
    return;
  const lines = [];
  if (errorMessage)
    lines.push(`### Paused on error:`, (0, import_util.stripAnsiEscapes)(errorMessage));
  else
    lines.push(`### Paused at end of test. ready for interaction`);
  for (let i = 0; i < context.pages().length; i++) {
    const page = context.pages()[i];
    const stateSuffix = context.pages().length > 1 ? i + 1 + " of " + context.pages().length : "state";
    lines.push(
      "",
      `### Page ${stateSuffix}`,
      `- Page URL: ${page.url()}`,
      `- Page Title: ${await page.title()}`.trim()
    );
    let console = errorMessage ? await import_tab.Tab.collectConsoleMessages(page) : [];
    console = console.filter((msg) => !msg.type || msg.type === "error");
    if (console.length) {
      lines.push("- Console Messages:");
      for (const message of console)
        lines.push(`  - ${message.toString()}`);
    }
    lines.push(
      `- Page Snapshot:`,
      "```yaml",
      await page._snapshotForAI(),
      "```"
    );
  }
  lines.push("");
  if (errorMessage)
    lines.push(`### Task`, `Try recovering from the error prior to continuing`);
  const config = {
    ...import_config.defaultConfig,
    capabilities: ["testing"]
  };
  await mcp.runOnPauseBackendLoop(new import_browserServerBackend.BrowserServerBackend(config, identityFactory(context)), lines.join("\n"));
}
function identityFactory(browserContext) {
  return {
    createContext: async (clientInfo, abortSignal, toolName) => {
      return {
        browserContext,
        close: async () => {
        }
      };
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runBrowserBackendAtEnd
});
