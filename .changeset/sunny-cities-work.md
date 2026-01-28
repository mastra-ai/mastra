---
"@mastra/ai-sdk": patch
---

fix(ai-sdk): import ReadableStream and TransformStream from node:stream/web to fix TypeScript async iterator errors

Fixed TypeScript build errors when using toAISdkStream() with for await...of loops. The function now explicitly imports ReadableStream and TransformStream from 'node:stream/web', ensuring the Node.js types (which include Symbol.asyncIterator support) are used instead of global types that may not have async iterator support in all TypeScript configurations.

This resolves issue #11884 where users encountered the error: "Type 'ReadableStream<InferUIMessageChunk<UIMessage>>' must have a '[Symbol.asyncIterator]()' method that returns an async iterator."
