---
'@mastra/factory': minor
---

Knowledge importers now sync into every Factory project automatically: destination scopes are resolved from the live project inventory on each run, so new projects start receiving Notion, Confluence, Jira, Linear, Zendesk, and Fireflies content without a restart. Each connection can also be routed to a selected subset of projects — or to none, keeping the connection established without linking any Factory project — via the new per-connection routing routes and the Sync-to control in the Knowledge settings section. Connect sessions are minted project-scoped when MASTRA_PROJECT_ID is set (with idempotent self-heal attachment for existing connections) so the importers() resolver can discover them. Also exported factoryProjectScopes for hosts that configure importers themselves.
