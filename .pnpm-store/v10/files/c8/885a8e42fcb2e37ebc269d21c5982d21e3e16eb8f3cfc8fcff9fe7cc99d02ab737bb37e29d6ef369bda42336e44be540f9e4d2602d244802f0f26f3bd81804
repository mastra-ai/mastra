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
var testBackend_exports = {};
__export(testBackend_exports, {
  TestServerBackend: () => TestServerBackend
});
module.exports = __toCommonJS(testBackend_exports);
var mcp = __toESM(require("../sdk/exports"));
var import_testContext = require("./testContext");
var testTools = __toESM(require("./testTools.js"));
var generatorTools = __toESM(require("./generatorTools.js"));
var plannerTools = __toESM(require("./plannerTools.js"));
var import_tools = require("../browser/tools");
var import_configLoader = require("../../common/configLoader");
var import_response = require("../browser/response");
class TestServerBackend {
  constructor(configOption, options) {
    this.name = "Playwright";
    this.version = "0.0.1";
    this._tools = [
      plannerTools.setupPage,
      generatorTools.setupPage,
      generatorTools.generatorReadLog,
      generatorTools.generatorWriteTest,
      testTools.listTests,
      testTools.runTests,
      testTools.debugTest
    ];
    this._context = new import_testContext.TestContext(options);
    this._configOption = configOption;
  }
  async initialize(server, clientInfo) {
    const rootPath = mcp.firstRootPath(clientInfo);
    if (this._configOption) {
      this._context.initialize(rootPath, (0, import_configLoader.resolveConfigLocation)(this._configOption));
      return;
    }
    if (rootPath) {
      this._context.initialize(rootPath, (0, import_configLoader.resolveConfigLocation)(rootPath));
      return;
    }
    this._context.initialize(rootPath, (0, import_configLoader.resolveConfigLocation)(void 0));
  }
  async listTools() {
    return [
      ...this._tools.map((tool) => mcp.toMcpTool(tool.schema)),
      ...import_tools.browserTools.map((tool) => mcp.toMcpTool(tool.schema, { addIntent: true }))
    ];
  }
  async afterCallTool(name, args, result) {
    if (!import_tools.browserTools.find((tool) => tool.schema.name === name))
      return;
    const response = (0, import_response.parseResponse)(result);
    if (response && !response.isError && response.code && typeof args?.["intent"] === "string")
      this._context.generatorJournal?.logStep(args["intent"], response.code);
  }
  async callTool(name, args, progress) {
    const tool = this._tools.find((tool2) => tool2.schema.name === name);
    if (!tool)
      throw new Error(`Tool not found: ${name}. Available tools: ${this._tools.map((tool2) => tool2.schema.name).join(", ")}`);
    const parsedArguments = tool.schema.inputSchema.parse(args || {});
    return await tool.handle(this._context, parsedArguments, progress);
  }
  serverClosed() {
    void this._context.close();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TestServerBackend
});
