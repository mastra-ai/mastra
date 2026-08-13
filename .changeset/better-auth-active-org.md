---
'@mastra/auth-better-auth': patch
---

Resolve a default `activeOrganizationId` from the user's existing memberships when the stored better-auth session never had one set. Nothing in a default sign-in flow calls the organization plugin's `setActive`, so the field was always null and org-scoped consumers saw users with no organization. The resolution is read-only and best-effort: the session row is not mutated, users with no memberships still authenticate, and a failed lookup falls back to today's behavior.
