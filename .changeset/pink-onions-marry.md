---
'@mastra/server': patch
---

Widened `BrowserStreamConfig.getToolset` to support async lookup. Existing synchronous implementations continue to work — the type now accepts `MastraBrowser | undefined` or `Promise<MastraBrowser | undefined>`.

This unblocks server-adapter implementations that need to resolve agents asynchronously (for example, hydrating stored agents from storage on first browser-stream connection).
