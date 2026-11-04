---
'@mastra/auth-studio': patch
---

Improved admin checks in Mastra Studio auth. `isOrganizationAdmin` now reuses the role from the already-verified session when the target organization is the session's active organization, so admin-gated routes no longer make an extra round trip to the shared API on every request. Checks against a different organization still look up the membership role live.
