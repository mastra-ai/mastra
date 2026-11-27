---
'@mastra/quickjs': minor
---

Added `stripTypes`, `maxInterruptTicks`, and `shouldInterrupt` options to `QuickJsCodeModeTransport`. Importing the package no longer loads the default TypeScript stripper, so it is safe on runtimes without Node.js globals such as Cloudflare Workers; pass `stripTypes` to supply your own. `maxInterruptTicks` and `shouldInterrupt` stop CPU-heavy programs on hosts where the guest clock is frozen. Fixes #31312
