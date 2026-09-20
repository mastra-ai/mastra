---
'@mastra/factory': minor
---

Knowledge importers now sync into every Factory project automatically: destination scopes are resolved from the live project inventory on each run, so new projects start receiving Notion, Confluence, Jira, Linear, Zendesk, and Fireflies content without a restart. Each connection can also be routed to a selected subset of projects via the new per-connection routing routes and the Sync-to control in the Knowledge settings section. Also exported factoryProjectScopes for hosts that configure importers themselves.
