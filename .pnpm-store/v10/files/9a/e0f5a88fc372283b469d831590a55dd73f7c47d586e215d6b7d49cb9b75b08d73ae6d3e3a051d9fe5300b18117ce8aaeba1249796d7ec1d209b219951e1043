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

// src/getEnvVariable.ts
var getEnvVariable_exports = {};
__export(getEnvVariable_exports, {
  getEnvVariable: () => getEnvVariable
});
module.exports = __toCommonJS(getEnvVariable_exports);
var import_meta = {};
var hasCloudflareProxyContext = (context) => {
  return !!context?.cloudflare?.env;
};
var hasCloudflareContext = (context) => {
  return !!context?.env;
};
var getEnvVariable = (name, context) => {
  if (typeof process !== "undefined" && process.env && typeof process.env[name] === "string") {
    return process.env[name];
  }
  if (typeof import_meta !== "undefined" && import_meta.env && typeof import_meta.env[name] === "string") {
    return import_meta.env[name];
  }
  if (hasCloudflareProxyContext(context)) {
    return context.cloudflare.env[name] || "";
  }
  if (hasCloudflareContext(context)) {
    return context.env[name] || "";
  }
  if (context && typeof context[name] === "string") {
    return context[name];
  }
  try {
    return globalThis[name];
  } catch {
  }
  return "";
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getEnvVariable
});
//# sourceMappingURL=getEnvVariable.js.map