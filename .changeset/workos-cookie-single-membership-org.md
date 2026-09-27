---
'@mastra/auth-workos': patch
---

Fixed cookie sessions losing their organization. When `fetchMemberships: true` is set and the AuthKit session has no organization, `authenticateToken` now uses the organization of the user's only membership, matching `getCurrentUser`. An explicit session organization still wins, and users with no memberships or several stay without an organization.
