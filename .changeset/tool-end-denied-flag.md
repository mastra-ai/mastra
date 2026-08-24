---
'@mastra/core': patch
---

Added a `denied` flag to the agent controller `tool_end` event. Approval-denied tool calls and tools aborted while parked at an approval gate already emit `tool_end` with `isError: false` (the tool didn't fail — it never ran), which made them indistinguishable from a real successful completion. Subscribers that need to know whether the tool actually did work can now gate on `denied !== true`.

```ts
session.subscribe(event => {
  if (event.type !== 'tool_end') return;
  if (event.isError) return; // tool ran and failed
  if (event.denied) return;  // tool was approval-denied or aborted before it ran
  // ...tool actually executed successfully
});
```
