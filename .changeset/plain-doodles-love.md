---
'@mastra/mcp-docs-server': patch
'@mastra/agent-builder': patch
'@mastra/observability': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/rag': patch
---

Standardized all logger calls across the codebase to use static string messages with structured data objects. Dynamic values are now passed as key-value pairs in the second argument instead of being interpolated into template literal strings. This improves log filterability and searchability in observability storage.

Removed ~150 redundant or noisy log calls including duplicate error logging after trackException and verbose in-memory storage CRUD traces.
