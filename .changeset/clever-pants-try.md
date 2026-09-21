---
'mastra': patch
---

Removed managed Redis from CLI hints and docs until the feature is released. `mastra env db create` help and errors now list `turso` and `neon` only, and deploy preflight messages no longer suggest provisioning a managed Redis. Organizations with the feature enabled can still attach one — the interactive deploy prompt is unchanged.
