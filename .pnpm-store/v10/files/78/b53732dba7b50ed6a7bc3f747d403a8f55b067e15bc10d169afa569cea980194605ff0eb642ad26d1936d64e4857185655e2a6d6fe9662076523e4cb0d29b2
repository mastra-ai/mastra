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
var codegen_exports = {};
__export(codegen_exports, {
  escapeWithQuotes: () => escapeWithQuotes,
  formatObject: () => formatObject,
  quote: () => quote
});
module.exports = __toCommonJS(codegen_exports);
function escapeWithQuotes(text, char = "'") {
  const stringified = JSON.stringify(text);
  const escapedText = stringified.substring(1, stringified.length - 1).replace(/\\"/g, '"');
  if (char === "'")
    return char + escapedText.replace(/[']/g, "\\'") + char;
  if (char === '"')
    return char + escapedText.replace(/["]/g, '\\"') + char;
  if (char === "`")
    return char + escapedText.replace(/[`]/g, "\\`") + char;
  throw new Error("Invalid escape char");
}
function quote(text) {
  return escapeWithQuotes(text, "'");
}
function formatObject(value, indent = "  ", mode = "multiline") {
  if (typeof value === "string")
    return quote(value);
  if (Array.isArray(value))
    return `[${value.map((o) => formatObject(o)).join(", ")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).filter((key) => value[key] !== void 0).sort();
    if (!keys.length)
      return "{}";
    const tokens = [];
    for (const key of keys)
      tokens.push(`${key}: ${formatObject(value[key])}`);
    if (mode === "multiline")
      return `{
${tokens.join(`,
${indent}`)}
}`;
    return `{ ${tokens.join(", ")} }`;
  }
  return String(value);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  escapeWithQuotes,
  formatObject,
  quote
});
