---
'mastracode-web': patch
---

Fixed GitHub routes returning 401 auth_required on platform deploys despite a valid WorkOS session. Custom API routes run on an isolated context where the auth gate's stashed user is invisible, so the routes now resolve the WorkOS session cookie directly.
