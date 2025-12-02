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

// src/file.ts
var file_exports = {};
__export(file_exports, {
  extension: () => extension,
  readJSONFile: () => readJSONFile
});
module.exports = __toCommonJS(file_exports);
function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", function() {
      const result = JSON.parse(reader.result);
      resolve(result);
    });
    reader.addEventListener("error", reject);
    reader.readAsText(file);
  });
}
var MimeTypeToExtensionMap = Object.freeze({
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico"
});
var extension = (mimeType) => {
  return MimeTypeToExtensionMap[mimeType];
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  extension,
  readJSONFile
});
//# sourceMappingURL=file.js.map