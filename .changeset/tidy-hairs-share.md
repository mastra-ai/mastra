---
'create-factory': minor
'@mastra/factory': minor
---

Added in-app connect and reconnect for Platform-managed Jira, GitLab, and incident.io accounts. Factory settings and onboarding now authorize providers directly — OAuth providers open the provider's own consent screen and API-key providers use a dialog — with no Mastra Platform round trip. Multiple connected accounts per provider are listed with per-account reconnect. GitLab and incident.io connections are discovered automatically instead of requiring environment-variable connection IDs.
