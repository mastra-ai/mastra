---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added Agent signals for sending contextual messages into agent thread loops and subscribing to thread activity.

Call `agent.sendSignal()` to inject context into a running agent loop. When the thread is idle, that same signal becomes the prompt that starts the next loop.

Use `agent.subscribeToThread()` to follow the raw stream chunks for a memory thread, observe signal echoes with stable IDs, and abort the active stream for that thread.

```ts
const subscription = await agent.subscribeToThread({ resourceId, threadId });

void (async () => {
  for await (const part of subscription.stream) {
    if (part.type === 'finish') {
      subscription.unsubscribe();
    }
  }
})();

agent.sendSignal({ type: 'user-message', contents: 'Use the latest answer' }, { resourceId, threadId });
```
