---
'@mastra/memory': patch
'@mastra/core': patch
---

Deduplicated message payloads when saving to memory storage. Tool-result payloads duplicated inside providerMetadata.mastra.modelOutput are replaced with internal references at write time and restored transparently on read, cutting stored message size roughly in half for tools that return large payloads (like screenshots). Fully backward compatible with existing rows.
