---
'@mastra/core': patch
---

Fixed agents sending empty file data when message input used AI SDK v7 tagged file data (`{ type: 'url', url }` or `{ type: 'data', data }`), such as the output of AI SDK v7's `convertToModelMessages`. Images and files now reach the model intact. File data in an unrecognized shape now throws a clear error instead of being silently dropped.
