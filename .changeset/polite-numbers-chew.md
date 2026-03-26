---
'@mastra/ai-sdk': patch
---

Fixed `data-tool-agent`, `data-tool-workflow`, and `data-tool-network` SSE events causing O(N²) payload growth that overwhelmed HTTP/2 connections. These events now only emit on completion instead of re-broadcasting full accumulated state on every chunk. See https://github.com/mastra-ai/mastra/issues/14685
