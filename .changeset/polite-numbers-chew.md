---
'@mastra/ai-sdk': patch
---

Reduced SSE payload size for `data-tool-agent`, `data-tool-workflow`, and `data-tool-network` events. Previously these re-broadcast the entire accumulated state on every chunk, causing O(N²) payload growth that overwhelmed HTTP/2 connections. Now `data-tool-agent` and `data-tool-network` only emit on completion, and `data-tool-workflow` emits on completion or suspension. See https://github.com/mastra-ai/mastra/issues/14685
