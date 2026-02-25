---
"@mastra/core": patch
---

fix(agent): use unique runId per parallel workflow tool call (#13473)

When an agent makes multiple parallel tool calls to the same workflow, all calls shared the agent's runId, causing `createRun()` to return the same cached Run instance. Only the first call's `start()` would process its input; the rest received identical results. Now each non-resume workflow tool call generates a unique runId via `randomUUID()`.
