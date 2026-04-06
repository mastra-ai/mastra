---
'@mastra/core': patch
---

Fully isolate `async_hooks` from shared chunks so importing `@mastra/core` in browser bundles never pulls in the Node-only dependency
