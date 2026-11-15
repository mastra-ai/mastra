---
'mastra': patch
---

Added `cards` to `mastra api factory work-item list`. With `scope: "sessions"`, `cards: "false"` names each card holding a session by the version of its body and sends no card.

```bash
mastra api factory work-item list <project-id> '{"scope":"sessions","cards":"false"}'
```
