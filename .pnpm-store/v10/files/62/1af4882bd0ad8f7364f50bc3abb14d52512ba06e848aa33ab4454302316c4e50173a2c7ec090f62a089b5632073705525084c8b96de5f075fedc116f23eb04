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

// src/versionSelector.ts
var versionSelector_exports = {};
__export(versionSelector_exports, {
  getMajorVersion: () => getMajorVersion,
  versionSelector: () => versionSelector
});
module.exports = __toCommonJS(versionSelector_exports);
var versionSelector = (clerkJSVersion, packageVersion = "5.102.0") => {
  if (clerkJSVersion) {
    return clerkJSVersion;
  }
  const prereleaseTag = getPrereleaseTag(packageVersion);
  if (prereleaseTag) {
    if (prereleaseTag === "snapshot") {
      return "5.102.0";
    }
    return prereleaseTag;
  }
  return getMajorVersion(packageVersion);
};
var getPrereleaseTag = (packageVersion) => packageVersion.trim().replace(/^v/, "").match(/-(.+?)(\.|$)/)?.[1];
var getMajorVersion = (packageVersion) => packageVersion.trim().replace(/^v/, "").split(".")[0];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getMajorVersion,
  versionSelector
});
//# sourceMappingURL=versionSelector.js.map