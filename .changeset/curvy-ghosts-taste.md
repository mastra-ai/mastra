---
'mastracode': patch
---

Allow Railway sandbox credentials (token and environmentId) to be passed via the mastraCode config instead of relying on process.env. This makes Railway-backed web workspaces work reliably regardless of how the web server process is launched.
