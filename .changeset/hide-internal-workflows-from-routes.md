---
'@mastra/server': patch
---

Workflow HTTP routes and `POST /schedules` no longer resolve internal workflows (such as a durable agent's `durable-agentic-loop` or the notification dispatcher). These now return 404, so agent runs can't be started or resumed through `/workflows/*` in a way that skips the agent routes' scope, ownership and approval checks.

If you called a durable agent's loop through the workflow routes, use the agent routes instead:

```diff
- POST /workflows/durable-agentic-loop/start-async
+ POST /agents/:agentId/stream

- POST /workflows/durable-agentic-loop/resume-async
+ POST /agents/:agentId/resume-stream
```
