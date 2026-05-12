---
'@internal/playground': patch
---

Fixed Studio not forwarding custom request headers (such as `Authorization` or `x-tenant-id`) on the SSO login and logout endpoints. Headers configured in Studio settings now flow through to `/auth/sso/login` and `/auth/logout`, matching the behavior of other Studio API calls. This unblocks setups where tenant middleware or composite auth requires a header on the SSO login request.
