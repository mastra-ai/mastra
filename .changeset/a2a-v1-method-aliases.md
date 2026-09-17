---
'@mastra/server': patch
---

Accept A2A v1 PascalCase JSON-RPC method names when the `A2A-Version: 1.0` header is present. Normalize method names before dispatch and streaming response selection while preserving legacy slash-style methods.
