---
'@mastra/auth-workos': patch
---

Fixed cookie sessions losing their organization on re-authentication. With `fetchMemberships: true`, a cookie session that has no selected organization now keeps the organization of the user's only membership. A selected session organization still takes precedence, and users with no memberships or several stay without an organization.
