---
'@mastra/core': patch
---

Fixed processor step `modelSettings` types so they accept the `timeout` field (`stepMs`, `totalMs`, `firstChunkMs`) that Mastra already applies at runtime. Input processors can now return `modelSettings.timeout` inline without a TypeScript error, and reading `timeout` from step arguments type-checks correctly.
