---
'@mastra/core': patch
---

Fixed durable agents running a tool call a second time, beside the first, when the server shuts down gracefully while the tool is running. A tool call that ignores the shutdown abort now keeps the run claimed until it finishes or the claim expires (15s by default), so recovery on another process waits for it during a normal shutdown. Its result is still discarded and recovery runs the call again, so tools with side effects should be safe to run twice.
