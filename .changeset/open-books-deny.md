---
'@mastra/server': minor
---

The auth middleware now stores the authenticated user normalized to the `MastraUser` shape on the request context (`mastra__normalizedUser`), produced by the auth provider's `toMastraUser()`. Dynamic agent configuration callbacks receive it as the optional `user` argument. When an RBAC provider is configured and the auth provider's user carries no role, the primary RBAC role is used.
