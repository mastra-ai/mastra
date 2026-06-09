---
'@internal/playground': minor
---

Added warnings when deleting or unsharing a referenced agent in Mastra Studio.

The agent-builder now uses the stored-agent dependents lookup endpoint to warn users
in two confirm dialogs:

- **Delete agent**: shows a warning listing caller-readable dependents by name (truncated
  to 5 plus "and N more") and a hidden count when the target is public and referenced
  from other workspaces. The confirm button is briefly disabled while the lookup is in
  flight.
- **Make private**: shows the same warnings on the public → private confirm dialog with
  softer copy ("may break", "may stop working").

Both warnings are informational — the user can always proceed.
