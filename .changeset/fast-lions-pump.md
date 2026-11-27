---
'@mastra/code-sdk': patch
---

Fixed the recall embedder worker failing to start under Bun. Bun's IPC channel object has no `ref()` or `unref()`, so starting a request threw `child.channel?.ref is not a function` and the queue stalled. The worker now calls those channel methods only when present; the process-level `ref()`/`unref()` calls that keep a finished CLI from hanging are unchanged.

A request whose dispatch throws synchronously, such as a refused `send()` or a failed spawn, now fails that one request with the original error and moves on to the next queued request on a fresh worker. Before, the throw left a stale active request behind and every later request waited forever.
