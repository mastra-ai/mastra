---
'@mastra/core': minor
---

Harness v1: Replace the flat `Session.getCurrentModel()` / `Session.switchModel()` methods with a `Session.models` namespace (§4.2a). The namespace exposes:

- `models.current()` — resolved model id for the next turn
- `models.hasSelected()` — true once any model or subagent override has been chosen
- `models.currentAuthStatus()` — auth status routed through `harness.models.getAuthStatus()`
- `models.switch({ model })` — durable model switch with `model_changed` emission
- `models.setSubagent({ agentType, model })` — pin a model for spawned subagents, emits `model_override_set`
- `models.getSubagent({ agentType })` — read the pinned subagent model, or `null` when unset

This is a hard cutover; the old flat methods are removed.
