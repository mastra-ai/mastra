---
'@mastra/core': patch
---

Fixed resuming a tool with a falsy resume payload.

A tool whose `resumeSchema` is a primitive can be resumed with `false`, `0` or `""`, and `false` is how a boolean human-in-the-loop tool declines. Those payloads were read as "no resume data".

**Background tasks no longer start a second run**

Resuming a suspended background task with one of those payloads left the task suspended forever and dispatched a new one. It now resumes the existing task.

**Same-run resumes keep their tool call**

A reloading client now still receives the replayed tool-call chunk, and the tool call is still recorded to memory when no matching invocation is on the message list.
