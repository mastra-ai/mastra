---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed A2A streaming responses to use SSE for streaming methods, preserved JSON-RPC request ID types, updated agent cards to publish the correct public execution URL, and relaxed A2A send configuration validation so official SDK requests that only set `blocking` are accepted.
