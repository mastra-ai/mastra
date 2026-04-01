---
'@mastra/core': patch
---

Fixed AsyncLocalStorage error when importing @mastra/core/observability in browser environments. Split observability utilities into browser-safe (utils.ts) and server-only (context-storage.ts) modules to prevent Node.js-only APIs from being bundled into client-side code.
