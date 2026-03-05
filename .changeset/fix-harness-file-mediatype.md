---
'@mastra/core': patch
---

Fix `mimeType` → `mediaType` typo in `sendMessage` file part construction. This caused file attachments to be routed through the V4 adapter instead of V5, preventing them from being correctly processed by AI SDK v5 providers.
