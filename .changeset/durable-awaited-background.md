---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Durable agents now honor the `awaited` background-task disposition by keeping the model turn open until the authoritative tool result is persisted. Replayed workflow steps adopt the matching persisted task, resume or restart it according to its status, and reconcile terminal results instead of dispatching the tool again.
