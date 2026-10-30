---
'@mastra/auth': patch
---

Added `toMastraUser()` support: the JWT auth provider normalizes the token payload through its `mapUser` option (or the default mapping), so dynamic agent configuration callbacks receive the mapped user as the `user` argument. The default mapping now also reads the token's `role` claim, so `/auth/me` and RBAC role resolution see it too.
