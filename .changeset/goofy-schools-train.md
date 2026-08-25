---
'@mastra/core': minor
'@mastra/server': patch
---

Added `generateTitle.emitEvent` so HTTP and stream clients receive the generated thread title without polling.

Thread titles are generated in the background after a run finishes. The `onTitleGenerated` callback only works for in-process callers, so an app driving an agent over HTTP had no way to know when the title was ready ([#21203](https://github.com/mastra-ai/mastra/issues/21203)).

With `emitEvent: true`, the run stream waits for the title and emits it as a transient `data-thread-title` chunk before `finish`:

```typescript
const memory = new Memory({
  options: {
    generateTitle: {
      emitEvent: true,
    },
  },
});

// Any stream consumer (including over HTTP) now receives the title:
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'data-thread-title') {
    console.log(chunk.data.threadId, chunk.data.title);
  }
}
```

The chunk is transient, so it is never persisted as part of the conversation. The default stays fully non-blocking: without `emitEvent`, title generation still runs in the background and does not delay the stream.
