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
var api_cjs_exports = {};
__export(api_cjs_exports, {
  apiCjsCodegen: () => apiCjsCodegen
});
module.exports = __toCommonJS(api_cjs_exports);
var import_api = require("./api.js");
var import_common = require("./common.js");
function apiCjsCodegen(modulePaths) {
  const { DTS } = (0, import_api.apiCodegen)(modulePaths);
  const apiJS = `${(0, import_common.header)("Generated `api` utility.")}
  const { anyApi } = require("convex/server");
  module.exports = {
    api: anyApi,
    internal: anyApi,
  };
  `;
  return {
    DTS,
    JS: apiJS
  };
}
//# sourceMappingURL=api_cjs.js.map
