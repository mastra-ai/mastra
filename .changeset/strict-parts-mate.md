---
'@mastra/mcp': patch
---

Fixed tools rebuilt with `toolsFromDefinitions()` or `toolFromDefinition()` connecting without the call's `requestContext`. The handshake a cached tool opens on its first execution now reaches the server's custom `fetch` with that call's `requestContext`, so servers that authenticate every request accept it. A tool call that reconnects still sends the new handshake with its `requestContext`, but server logs on the new connection are no longer labelled with it. Fixes #29531.
