---
'@mastra/auth': patch
'@mastra/auth-auth0': patch
'@mastra/auth-clerk': patch
---

Fixed every protected route answering `403 Missing required permission` when RBAC was used with a standard OIDC access token. These tokens identify the user with `sub` and carry no `id` claim, so the user's roles were never loaded. The authenticated user now has `id` set to the token's `sub`. A token that already has an `id` claim keeps it.
