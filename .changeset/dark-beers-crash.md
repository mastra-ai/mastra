---
'@mastra/ai-sdk': patch
---

Added `messageMetadata` and `onError` options to `toAISdkV5Stream`, enabling you to attach custom metadata to stream chunks and handle errors during stream conversion.

**messageMetadata**

Attach custom metadata to start and finish chunks by providing a function that receives the current stream part:

```typescript
const stream = toAISdkV5Stream(agentStream, {
  from: 'agent',
  messageMetadata: ({ part }) => ({
    timestamp: Date.now(),
    sessionId: 'session-123',
    partType: part.type
  })
});
```

**onError**

Customize error handling during stream conversion:

```typescript
const stream = toAISdkV5Stream(agentStream, {
  from: 'agent',
  onError: (error) => {
    console.error('Stream error:', error);
    return JSON.stringify({ error: error.message });
  }
});
```
