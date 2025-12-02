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

// src/object.ts
var object_exports = {};
__export(object_exports, {
  applyFunctionToObj: () => applyFunctionToObj,
  filterProps: () => filterProps,
  removeUndefined: () => removeUndefined,
  without: () => without
});
module.exports = __toCommonJS(object_exports);
var without = (obj, ...props) => {
  const copy = { ...obj };
  for (const prop of props) {
    delete copy[prop];
  }
  return copy;
};
var removeUndefined = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== void 0 && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {});
};
var applyFunctionToObj = (obj, fn) => {
  const result = {};
  for (const key in obj) {
    result[key] = fn(obj[key], key);
  }
  return result;
};
var filterProps = (obj, filter) => {
  const result = {};
  for (const key in obj) {
    if (obj[key] && filter(obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyFunctionToObj,
  filterProps,
  removeUndefined,
  without
});
//# sourceMappingURL=object.js.map