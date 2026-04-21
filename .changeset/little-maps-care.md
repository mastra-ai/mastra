---
'@mastra/auth-workos': patch
---

Fixed WorkOS FGA resource mapping to fall back to the original Mastra resource ID when deriveId does not return one, and added a typed error when organization memberships are not loaded for FGA enforcement.
