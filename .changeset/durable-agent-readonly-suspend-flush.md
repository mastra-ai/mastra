---
'@mastra/core': patch
---

Fixed `DurableAgent` still writing messages to the thread during tool-call suspension (approval / in-execution suspend) and background-task completion when `memory.options.readOnly` was set. Follow-up to the readOnly fix for the durable finish path (#18921) — these mid-run flush paths in `steps/tool-call.ts` had the same missing guard.
