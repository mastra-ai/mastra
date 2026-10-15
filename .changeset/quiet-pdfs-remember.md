---
'@mastra/core': patch
---

Fixed document citations disappearing after a reload. When a model streams a document source (for example an Anthropic PDF citation), memory now stores it as a `source-document` part with its media type, title and filename. Previously it was saved as a URL source with an empty `url`, so reloaded conversations showed an empty link instead of the cited document.

```ts
const { messages } = await memory.recall({ threadId, resourceId });
// assistant parts now include:
// { type: 'source-document', sourceId: 'doc-1', mediaType: 'application/pdf', title: 'Q3 report', filename: 'q3.pdf' }
```

AI SDK v5 UI messages now also keep `source-document` parts and the `sourceId` and `title` of URL sources when converting to and from stored messages.
