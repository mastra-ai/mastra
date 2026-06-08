---
'@mastra/react': minor
---

Show a sent user message instantly as a pending bubble in the chat thread, then settle it in place when the server confirms it — instead of staging it near the composer. The optimistic bubble and the outgoing message share a client-generated correlation id, so the server echo reconciles the exact bubble with no duplicate message.
