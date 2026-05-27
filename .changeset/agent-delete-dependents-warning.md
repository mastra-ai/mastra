---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground': minor
---

Warn when deleting or unsharing a referenced agent.

Adds a new server endpoint `GET /stored/agents/:storedAgentId/dependents` that returns the
agents that use the target agent as a sub-agent. The response includes a `dependents`
list (caller-visible) and a `hiddenCount` aggregating cross-workspace private dependents
of a public target so we never leak names. The endpoint mirrors `GET` for access (404 when
the caller cannot read the target).

The Mastra Studio agent-builder now uses this in two confirm dialogs:

- Delete agent: shows a warning listing dependents (truncated to 5 + "and N more")
  and the hidden count when applicable. Confirm stays enabled but is briefly disabled
  while the lookup is in flight.
- Make private: shows the same warnings on the public → private confirm dialog with
  softer copy ("may break", "may stop working").

Both warnings are informational — the user can always proceed.
