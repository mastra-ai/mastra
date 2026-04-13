---
'@mastra/core': patch
---

Fixed usage/token cost data being lost when aborting a stream via AbortSignal. Previously, aborting a stream would cause the usage promise to resolve with undefined values or hang indefinitely. Now, `stream.usage` properly resolves with accumulated partial usage data (defaulting to zeros if no usage was tracked before abort). This fix applies to both direct agent streaming and network-layer (Assistant UI) streaming paths.
