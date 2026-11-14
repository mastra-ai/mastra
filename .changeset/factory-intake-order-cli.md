---
'mastra': patch
---

Added `mastra api` commands for Factory intake order and Not routed items: read and set a project's intake order, list items no board took, and route one again.

```sh
mastra api factory intake-order get <project-id>
mastra api factory intake-order set <project-id> '{"boardKeys":["docs","work"]}'
mastra api factory not-routed list <project-id> '{"limit":50}'
mastra api factory not-routed route-again <project-id> <decision-id>
```
