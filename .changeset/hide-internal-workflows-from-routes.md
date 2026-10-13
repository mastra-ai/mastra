---
'@mastra/server': patch
---

Workflow HTTP routes and `POST /schedules` no longer resolve internal workflows (such as a durable agent's `durable-agentic-loop` or the notification dispatcher). These now return 404, so agent runs can't be started or resumed through `/workflows/*` in a way that skips the agent routes' scope, ownership and approval checks.
