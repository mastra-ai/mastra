---
'mastra': minor
---

Added `mastra api factory intake-route` commands to list, get, create, update, delete and reorder a Factory project's intake routes.

```sh
mastra api factory intake-route create <project-id> '{"name":"Trusted to Triage","when":{"operator":"AND","conditions":[{"field":"author.trusted","operator":"equals","value":true}]},"target":{"boardKey":"work","phaseKey":"triage"}}'
mastra api factory intake-route reorder <project-id> '{"ids":["<route-id>","<route-id>"]}'
```
