---
'mastracode': patch
---

Added dedicated routes to the mastracode web UI: the chat now lives at /chat and signing in happens on a new /signin page. When web auth is enabled, signed-out visitors are redirected to /signin (instead of straight to the hosted login) and returned to where they were headed after signing in. The sidebar no longer shows a Sign in button; it only shows the signed-in identity and sign-out.

The UI now reads a `window.__MASTRACODE_CONFIG__` runtime flag (injected by the Vite dev server from the WorkOS env vars) telling it whether auth is enabled, so it skips the `/auth/me` probe entirely when auth is disabled. All web UI fetches (auth, GitHub, project resolution) go through the injected API base URL so requests reach the backend when the dev frontend and server run on different ports, and deep-linking to /chat no longer serves raw module source from the dev server.
