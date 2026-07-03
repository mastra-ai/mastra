---
'mastracode': patch
---

Added dedicated routes to the mastracode web UI: the chat now lives at /chat and signing in happens on a new /signin page. When web auth is enabled, signed-out visitors are redirected to /signin (instead of straight to the hosted login) and returned to where they were headed after signing in. The sidebar no longer shows a Sign in button; it only shows the signed-in identity and sign-out.
