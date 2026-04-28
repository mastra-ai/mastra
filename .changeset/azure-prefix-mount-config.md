---
'@mastra/azure': patch
---

Fixed AzureBlobFilesystem mount configs to include configured prefixes. Sandboxes that support Azure Blob mounts now mount only the configured prefix instead of the entire container.
