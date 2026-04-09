---
'@mastra/azure': minor
'@internal/workspace-test-utils': patch
---

Add `@mastra/azure`, an Azure Blob Storage `WorkspaceFilesystem` provider with support for connection string, account key, SAS token, `DefaultAzureCredential`, and anonymous auth, plus prefix namespacing and read-only mode.

`@internal/workspace-test-utils` now recognizes `azure-blob` as a valid mount-config type.
