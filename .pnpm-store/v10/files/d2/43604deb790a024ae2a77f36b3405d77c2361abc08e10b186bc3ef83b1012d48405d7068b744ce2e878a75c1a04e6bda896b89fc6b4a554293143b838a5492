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
var network_exports = {};
__export(network_exports, {
  default: () => network_default
});
module.exports = __toCommonJS(network_exports);
var import_bundle = require("../../sdk/bundle");
var import_tool = require("./tool");
const requests = (0, import_tool.defineTabTool)({
  capability: "core",
  schema: {
    name: "browser_network_requests",
    title: "List network requests",
    description: "Returns all network requests since loading the page",
    inputSchema: import_bundle.z.object({}),
    type: "readOnly"
  },
  handle: async (tab, params, response) => {
    const requests2 = await tab.requests();
    for (const request of requests2)
      response.addResult(await renderRequest(request));
  }
});
async function renderRequest(request) {
  const result = [];
  result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
  const hasResponse = request._hasResponse;
  if (hasResponse) {
    const response = await request.response();
    if (response)
      result.push(`=> [${response.status()}] ${response.statusText()}`);
  }
  return result.join(" ");
}
var network_default = [
  requests
];
