---
'@mastra/server': patch
'@mastra/express': patch
'@mastra/elysia': patch
---

Fixed route permission checks being skipped for Studio requests on the Express and Elysia adapters when RBAC is configured only under `studio`. Authenticated Studio users without a route's required permission now get a 403 instead of being allowed through. Also fixed the default-deny check for auth configs without `authorize` or `rules` so it uses Studio RBAC for Studio requests.
