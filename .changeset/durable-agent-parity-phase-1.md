---
'@mastra/core': patch
---

`DurableAgent` now matches `Agent` behavior in three places where the durable loop previously diverged:

- `isTaskComplete` scorers receive `requestContext` as `customContext`, so the same scorer code works on both agents. Only JSON-serializable entries from `requestContext` are forwarded; non-serializable values are dropped. Do not store secrets in `RequestContext` if you persist durable agent snapshots.
- Provider-defined tools (e.g. OpenAI `web_search`) resolve and execute when invoked by the model, instead of surfacing as `ToolNotFoundError`.
- Each iteration of a multi-step durable run produces a distinct assistant `messageId`, matching the non-durable loop and unblocking downstream consumers (signal drains, audit logs, replay) that key off message identity.
