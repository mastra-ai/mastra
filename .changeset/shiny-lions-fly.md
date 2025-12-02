---
"@mastra/client-js": patch
"@mastra/server": patch
---

fix(a2a): fix streaming and memory support for A2A protocol

**Client (`@mastra/client-js`):**
- Fixed `sendStreamingMessage` to properly return a streaming response instead of attempting to parse it as JSON

**Server (`@mastra/server`):**
- Fixed A2A message handler to pass `contextId` as `threadId` for memory persistence across conversations
- Added support for user-provided `resourceId` via `params.metadata.resourceId` or `message.metadata.resourceId`, falling back to `agentId`
