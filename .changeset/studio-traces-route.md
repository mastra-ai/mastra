---
'@internal/playground': patch
---

Moved the Studio traces list to `/traces`, so it matches the sidebar link, the breadcrumb and the trace page at `/traces/:traceId`. Opening or reloading `/traces` used to hit a router error screen because the list was served from `/observability`. Existing `/observability` links redirect to `/traces` and keep their query filters.
