import {
  FileMetadata,
  StorageActionWriter,
  FileStorageId,
  StorageReader,
  StorageWriter,
} from "../storage.js";
import { version } from "../../index.js";
import { performAsyncSyscall, performJsSyscall } from "./syscall.js";
import { validateArg } from "./validate.js";

export function setupStorageReader(requestId: string): StorageReader {
  return {
    getUrl: async (storageId: FileStorageId) => {
      validateArg(storageId, 1, "getUrl", "storageId");
      return await performAsyncSyscall("1.0/storageGetUrl", {
        requestId,
        version,
        storageId,
      });
    },
    getMetadata: async (storageId: FileStorageId): Promise<FileMetadata> => {
      return await performAsyncSyscall("1.0/storageGetMetadata", {
        requestId,
        version,
        storageId,
      });
    },
  };
}

export function setupStorageWriter(requestId: string): StorageWriter {
  const reader = setupStorageReader(requestId);
  return {
    generateUploadUrl: async () => {
      return await performAsyncSyscall("1.0/storageGenerateUploadUrl", {
        requestId,
        version,
      });
    },
    delete: async (storageId: FileStorageId) => {
      await performAsyncSyscall("1.0/storageDelete", {
        requestId,
        version,
        storageId,
      });
    },
    getUrl: reader.getUrl,
    getMetadata: reader.getMetadata,
  };
}

export function setupStorageActionWriter(
  requestId: string,
): StorageActionWriter {
  const writer = setupStorageWriter(requestId);
  return {
    ...writer,
    store: async (blob: Blob, options?: { sha256?: string }) => {
      return await performJsSyscall("storage/storeBlob", {
        requestId,
        version,
        blob,
        options,
      });
    },
    get: async (storageId: FileStorageId) => {
      return await performJsSyscall("storage/getBlob", {
        requestId,
        version,
        storageId,
      });
    },
  };
}
