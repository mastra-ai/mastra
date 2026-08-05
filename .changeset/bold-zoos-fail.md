---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed `@mastra/ai-sdk/ui` crashing in browser bundles with `TypeError: createRequire is not a function`. Importing `toAISdkMessages` (or anything reaching `@mastra/core/agent/message-list`) eagerly executed Node-only `createRequire` interop from a shared build chunk; the Node-only vendored test tooling is now built separately so browser-consumable chunks stay free of Node built-ins.
