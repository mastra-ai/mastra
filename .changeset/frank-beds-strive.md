---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Improved Mastra's A2A compatibility with the official SDK and protocol.

- Fixed A2A streaming responses to use SSE for streaming methods.
- Preserved JSON-RPC request ID types.
- Updated agent cards to publish the correct public execution URL.
- Relaxed A2A send configuration validation so official SDK requests that only set `blocking` are accepted.
- Added official-style `@mastra/client-js` A2A methods such as `getAgentCard()` and `sendMessageStream()`.
- Added typed A2A stream consumption in `@mastra/client-js` while keeping deprecated methods available for backward compatibility.
