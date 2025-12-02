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
var common_exports = {};
__export(common_exports, {
  apiComment: () => apiComment,
  compareStrings: () => compareStrings,
  header: () => header
});
module.exports = __toCommonJS(common_exports);
function header(oneLineDescription) {
  return `/* eslint-disable */
  /**
   * ${oneLineDescription}
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run \`npx convex dev\`.
   * @module
   */
  `;
}
function apiComment(apiName, type) {
  return `
  /**
     * A utility for referencing Convex functions in your app's${type ? ` ${type}` : ""} API.
     *
     * Usage:
     * \`\`\`js
     * const myFunctionReference = ${apiName}.myModule.myFunction;
     * \`\`\`
     */`;
}
function compareStrings(a, b) {
  return a.localeCompare(b);
}
//# sourceMappingURL=common.js.map
