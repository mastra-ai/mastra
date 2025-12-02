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
var evaluate_exports = {};
__export(evaluate_exports, {
  default: () => evaluate_default
});
module.exports = __toCommonJS(evaluate_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
var javascript = __toESM(require("../codegen"));
var import_utils = require("./utils");
const evaluateSchema = import_bundle.z.object({
  function: import_bundle.z.string().describe("() => { /* code */ } or (element) => { /* code */ } when element is provided"),
  element: import_bundle.z.string().optional().describe("Human-readable element description used to obtain permission to interact with the element"),
  ref: import_bundle.z.string().optional().describe("Exact target element reference from the page snapshot")
});
const evaluate = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_evaluate",
    title: "Evaluate JavaScript",
    description: "Evaluate JavaScript expression on page or element",
    inputSchema: evaluateSchema,
    type: "action"
  },
  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();
    let locator;
    if (params.ref && params.element) {
      locator = await tab.refLocator({ ref: params.ref, element: params.element });
      response.addCode(`await page.${await (0, import_utils.generateLocator)(locator)}.evaluate(${javascript.quote(params.function)});`);
    } else {
      response.addCode(`await page.evaluate(${javascript.quote(params.function)});`);
    }
    await tab.waitForCompletion(async () => {
      const receiver = locator ?? tab.page;
      const result = await receiver._evaluateFunction(params.function);
      response.addResult(JSON.stringify(result, null, 2) || "undefined");
    });
  }
});
var evaluate_default = [
  evaluate
];
