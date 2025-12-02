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
var storage_impl_exports = {};
__export(storage_impl_exports, {
  setupStorageActionWriter: () => setupStorageActionWriter,
  setupStorageReader: () => setupStorageReader,
  setupStorageWriter: () => setupStorageWriter
});
module.exports = __toCommonJS(storage_impl_exports);
var import__ = require("../../index.js");
var import_syscall = require("./syscall.js");
var import_validate = require("./validate.js");
function setupStorageReader(requestId) {
  return {
    getUrl: async (storageId) => {
      (0, import_validate.validateArg)(storageId, 1, "getUrl", "storageId");
      return await (0, import_syscall.performAsyncSyscall)("1.0/storageGetUrl", {
        requestId,
        version: import__.version,
        storageId
      });
    },
    getMetadata: async (storageId) => {
      return await (0, import_syscall.performAsyncSyscall)("1.0/storageGetMetadata", {
        requestId,
        version: import__.version,
        storageId
      });
    }
  };
}
function setupStorageWriter(requestId) {
  const reader = setupStorageReader(requestId);
  return {
    generateUploadUrl: async () => {
      return await (0, import_syscall.performAsyncSyscall)("1.0/storageGenerateUploadUrl", {
        requestId,
        version: import__.version
      });
    },
    delete: async (storageId) => {
      await (0, import_syscall.performAsyncSyscall)("1.0/storageDelete", {
        requestId,
        version: import__.version,
        storageId
      });
    },
    getUrl: reader.getUrl,
    getMetadata: reader.getMetadata
  };
}
function setupStorageActionWriter(requestId) {
  const writer = setupStorageWriter(requestId);
  return {
    ...writer,
    store: async (blob, options) => {
      return await (0, import_syscall.performJsSyscall)("storage/storeBlob", {
        requestId,
        version: import__.version,
        blob,
        options
      });
    },
    get: async (storageId) => {
      return await (0, import_syscall.performJsSyscall)("storage/getBlob", {
        requestId,
        version: import__.version,
        storageId
      });
    }
  };
}
//# sourceMappingURL=storage_impl.js.map
