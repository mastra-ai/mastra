---
'@mastra/core': patch
---

Fix infinite agentic loop with client tools (no `execute`). When the model finished with `tool-calls` and every called tool was a client tool — that is, a tool whose `execute` function was stripped by `listClientTools` because it runs on the caller's side — the outer dowhile loop treated the tool calls as "pending" and re-invoked the model without adding a tool result. The model then produced the same tool call again, repeating until `maxSteps` was reached. The loop now considers a tool call "pending" only if the server can actually execute it (the resolved tool has an `execute` function) or the model already resolved it (`providerExecuted`). Mixed turns with at least one server-executable tool still continue as before.
