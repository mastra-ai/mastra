---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `include` in `listMessages` and `listMessagesByResourceId` so it can no longer return a message that belongs to a different resource. When you pass a `resourceId`, the target message and its surrounding context messages now stay inside that resource. Includes that cross threads inside the same resource keep working, so semantic recall with `scope: 'resource'` is unchanged.

**Behaviour change in the in-memory store**

The in-memory store read the context window from the thread you queried. It now reads the window from the thread that owns the target message, which is what the SQL stores already did. This only changes the result when an `include` entry names a message from another thread.

The in-memory store also ignored `include` in `listMessagesByResourceId`. It now returns the included messages, like `@mastra/libsql` and `@mastra/pg` do.

Fixes #20604.
