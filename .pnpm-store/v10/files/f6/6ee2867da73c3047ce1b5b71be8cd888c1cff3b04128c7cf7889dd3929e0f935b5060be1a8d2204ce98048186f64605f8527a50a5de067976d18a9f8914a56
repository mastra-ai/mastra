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
var indexes_exports = {};
__export(indexes_exports, {
  addProgressLinkIfSlow: () => addProgressLinkIfSlow,
  formatIndex: () => formatIndex
});
module.exports = __toCommonJS(indexes_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_dashboard = require("./dashboard.js");
function addProgressLinkIfSlow(msg, deploymentName, start) {
  if (Date.now() - start > 1e4) {
    const dashboardUrl = (0, import_dashboard.deploymentDashboardUrlPage)(
      deploymentName,
      `/data?showSchema=true`
    );
    msg = msg.concat(`
See progress here: ${dashboardUrl}`);
  }
  return msg;
}
function formatIndex(index) {
  const [tableName, indexName] = index.name.split(".");
  return `${tableName}.${import_chalk.default.bold(indexName)} ${import_chalk.default.gray(formatIndexFields(index))}${index.staged ? import_chalk.default.blue("  (staged)") : ""}`;
}
function formatIndexFields(index) {
  switch (index.type) {
    case "database":
      return "  " + index.fields.map((f) => import_chalk.default.underline(f)).join(", ");
    case "search":
      return `${import_chalk.default.cyan("(text)")}   ${import_chalk.default.underline(index.searchField)}${formatFilterFields(index.filterFields)}`;
    case "vector":
      return `${import_chalk.default.cyan("(vector)")}   ${import_chalk.default.underline(index.vectorField)} (${index.dimensions} dimensions)${formatFilterFields(index.filterFields)}`;
    default:
      index;
      return "";
  }
}
function formatFilterFields(filterFields) {
  if (filterFields.length === 0) {
    return "";
  }
  return `, filter${filterFields.length === 1 ? "" : "s"} on ${filterFields.map((f) => import_chalk.default.underline(f)).join(", ")}`;
}
//# sourceMappingURL=indexes.js.map
