---
'mastracode': patch
---

The web UI now reads a `window.__MASTRACODE_CONFIG__` runtime flag (injected by the Vite dev server from the WorkOS env vars) telling it whether auth is enabled, so it skips the `/auth/me` probe entirely when auth is disabled instead of relying on an ambiguous response.
