---
'@mastra/core': patch
---

Made the workspace LSP manager's per-file lock hand out access in arrival order. Diagnostics requests for the same file were already serialized; a request that arrived at the moment the previous one finished could jump ahead of requests that had been waiting longer. Requests for different files still run in parallel.
