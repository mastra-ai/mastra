---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Tool approval and tool suspension requests now report whether they were actually accepted. Previously, `approveTool()` and `respondToToolSuspension()` always returned success, even when the decision was stale, a duplicate, or answered a question that was no longer pending. They now resolve to `{ ok: false, reason }` in those cases, so you can tell an accepted decision from one that was ignored.

```ts
const ack = await session.approveTool(toolCallId, true);
if (!ack.ok) console.warn(`Approval not applied: ${ack.reason}`);
```
