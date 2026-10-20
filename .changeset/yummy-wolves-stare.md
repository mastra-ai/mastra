---
'@mastra/teams': patch
---

Fixed Microsoft Teams bot provisioning to create single-tenant bots by default, deriving the tenant from the signed-in account. Microsoft no longer accepts new multi-tenant bot registrations.
