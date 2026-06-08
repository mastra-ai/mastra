---
'@internal/playground': patch
---

Added tool provider integrations to the Agent Builder:

- New `/integrations` settings page to view, authorize (via OAuth), and disconnect tool-provider connections, with admin-grouped author rows.
- Integration tools now appear in the Builder tool picker with connection badges. Each badge supports inline rename (with autosave) and disconnect (with confirmation). Clicking "Connect" on an unchecked tool auto-checks it and pins the freshly authorized connection.
- Builder connection picker is scoped to the current user by default — admins editing their own agents see only their own connections.
