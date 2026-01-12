---
'@mastra/core': patch
---

Emit error chunk and call onError when agent workflow step fails

When a workflow step fails (e.g., tool not found), the error is now properly emitted as an error chunk to the stream and the onError callback is called. This fixes the issue where agent.generate() would throw "promise 'text' was not resolved or rejected" instead of the actual error message.
