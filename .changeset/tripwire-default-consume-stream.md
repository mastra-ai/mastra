---
'@mastra/core': patch
---

Forward-port the `tripwire` chunk handler into `defaultConsumeStream` so processor block reasons are still surfaced to chat platforms after the channels refactor. Without this, agents using `strategy: "block"` processors silently drop the block notification (regression of #15344 once the inline `consumeAgentStream` is replaced).
