---
'mastracode': patch
---

The web server now injects a runtime config flag into the served UI telling it whether auth is enabled, so the web UI skips the `/auth/me` probe entirely when auth is disabled instead of receiving an ambiguous HTML response.
