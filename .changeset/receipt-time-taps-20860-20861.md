---
'mastracode': patch
---

Dispatch PermissionRequest hooks and the agent_done notification at event receipt instead of from the TUI's serialized event queue, so external integrations hear about new permission prompts and finished runs even while an earlier prompt is pending. Also removes the spurious agent_done ping that fired after answering a suspended run's prompt.
