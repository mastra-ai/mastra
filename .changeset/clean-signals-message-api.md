---
"@mastra/core": minor
---

Added `agent.sendMessage()` and `agent.queueMessage()` APIs for sending user-authored input into agent threads. These are intended to be used with `agent.subscribeToThread()` and replace lower-level `agent.sendSignal()` calls for regular user messages.

```ts
await agent.sendMessage('Continue with the latest user input', { resourceId, threadId });
await agent.queueMessage('Follow up after the active turn finishes', { resourceId, threadId });

await agent.sendMessage(
  {
    contents: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'file', data: imageBase64, mediaType: 'image/png', filename: 'screenshot.png' },
    ],
  },
  { resourceId, threadId },
);
```
