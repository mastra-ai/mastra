"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var console_exports = {};
__export(console_exports, {
  default: () => console_default
});
module.exports = __toCommonJS(console_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
const console = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_console_messages",
    title: "Get console messages",
    description: "Returns all console messages",
    inputSchema: import_bundle.z.object({
      onlyErrors: import_bundle.z.boolean().optional().describe("Only return error messages")
    }),
    type: "readOnly"
  },
  handle: async (tab, params, response) => {
    const messages = await tab.consoleMessages(params.onlyErrors ? "error" : void 0);
    messages.map((message) => response.addResult(message.toString()));
  }
});
var console_default = [
  console
];
