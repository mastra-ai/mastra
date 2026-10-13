---
'@mastra/factory': patch
---

Fixed the Factory web UI hanging on the splash screen when authentication is disabled (`auth: null` or `MASTRACODE_AUTH_DISABLED=1`). `GET /auth/me` now returns 404, so the UI shows that no authentication provider is configured instead of retrying forever.
