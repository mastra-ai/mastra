"use strict";
import { version } from "../../index.js";
import { performAsyncSyscall, performJsSyscall } from "./syscall.js";
import { validateArg } from "./validate.js";
export function setupStorageReader(requestId) {
  return {
    getUrl: async (storageId) => {
      validateArg(storageId, 1, "getUrl", "storageId");
      return await performAsyncSyscall("1.0/storageGetUrl", {
        requestId,
        version,
        storageId
      });
    },
    getMetadata: async (storageId) => {
      return await performAsyncSyscall("1.0/storageGetMetadata", {
        requestId,
        version,
        storageId
      });
    }
  };
}
export function setupStorageWriter(requestId) {
  const reader = setupStorageReader(requestId);
  return {
    generateUploadUrl: async () => {
      return await performAsyncSyscall("1.0/storageGenerateUploadUrl", {
        requestId,
        version
      });
    },
    delete: async (storageId) => {
      await performAsyncSyscall("1.0/storageDelete", {
        requestId,
        version,
        storageId
      });
    },
    getUrl: reader.getUrl,
    getMetadata: reader.getMetadata
  };
}
export function setupStorageActionWriter(requestId) {
  const writer = setupStorageWriter(requestId);
  return {
    ...writer,
    store: async (blob, options) => {
      return await performJsSyscall("storage/storeBlob", {
        requestId,
        version,
        blob,
        options
      });
    },
    get: async (storageId) => {
      return await performJsSyscall("storage/getBlob", {
        requestId,
        version,
        storageId
      });
    }
  };
}
//# sourceMappingURL=storage_impl.js.map
