---
'@mastra/azure': minor
'@internal/workspace-test-utils': patch
---

Add `@mastra/azure`, a new Azure Blob Storage workspace filesystem provider, so teams running on Azure can use native Blob Storage containers for workspace persistence without relying on S3/GCS workarounds.

The provider implements the `WorkspaceFilesystem` interface (readFile, writeFile, appendFile, deleteFile, copyFile, moveFile, mkdir, rmdir, readdir, exists, stat) on top of `@azure/storage-blob`. Supported authentication strategies: connection string, account key via `StorageSharedKeyCredential`, SAS token, `DefaultAzureCredential` (via optional `@azure/identity` peer dep), and anonymous access. Includes prefix namespacing, read-only mode, MastraEditor provider descriptor, unit tests, integration tests (real Azure + Azurite emulator), and the shared filesystem conformance suite.

The shared workspace filesystem test suite (`@internal/workspace-test-utils`) now recognizes `azure-blob` as a valid mount-config type alongside `s3`, `gcs`, `local`, and `r2`.
