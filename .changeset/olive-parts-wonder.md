---
'@mastra/core': patch
---

Add `response` to finish chunk payload for output processor metadata access

When using output processors with streaming, metadata added via `processOutputResult` is now accessible in the finish chunk's `payload.response.uiMessages`. This allows clients consuming streams over HTTP (e.g., via `/stream/ui`) to access processor-added metadata.

```typescript
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'finish') {
    const uiMessages = chunk.payload.response?.uiMessages;
    const metadata = uiMessages?.find(m => m.role === 'assistant')?.metadata;
  }
}
```

Fixes #11454
