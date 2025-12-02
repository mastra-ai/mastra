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
var wait_until_exports = {};
__export(wait_until_exports, {
  waitUntil: () => waitUntil
});
module.exports = __toCommonJS(wait_until_exports);
var import_get_context = require("./get-context");
const waitUntil = (promise) => {
  if (promise === null || typeof promise !== "object" || typeof promise.then !== "function") {
    throw new TypeError(
      `waitUntil can only be called with a Promise, got ${typeof promise}`
    );
  }
  return (0, import_get_context.getContext)().waitUntil?.(promise);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  waitUntil
});
