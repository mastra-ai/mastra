---
'@mastra/server': patch
---

Hardened the stored-agent and stored-skill favorite toggle endpoints (`PUT`/`DELETE /stored/{agents,skills}/:id/favorite`) so callers can no longer favorite or unfavorite entities outside their tenant scope.

Deployments that configure `storedResources.scope` now get the same 404-on-mismatch protection on favorite toggles that already applied to read/update/delete. Single-tenant deployments are unaffected.

Also corrected JSDoc on stored-agent and stored-skill handlers to reference the canonical resource/action names (`stored-agents:read`, `stored-skills:write`).
