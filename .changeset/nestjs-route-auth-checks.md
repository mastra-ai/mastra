---
'@mastra/nestjs': patch
---

Enforce route permission and FGA checks in the NestJS adapter. Routes now return 403 when the user lacks a route's required permission (when an RBAC provider is configured) or when the configured FGA provider denies access, matching the other server adapters.
