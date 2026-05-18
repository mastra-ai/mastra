---
'@mastra/core': minor
'@mastra/editor': minor
---

Add runtime fan-out for stored `toolIntegrations`. New
`resolveStoredToolIntegrations` helper in `@mastra/core/tool-integration`
iterates registered `ToolIntegration` instances, resolves tools per
connection, and applies `__SUFFIX` disambiguation when a tool service has
multiple connections (suffix derived from each connection's label).

The editor hydration path in `@mastra/editor` now calls this helper
alongside the legacy `integrationTools` path, so both storage shapes
coexist during the v1 compatibility window. Single-binding tools keep
their original slug; multi-binding tools become distinct LLM-visible
tools (e.g. `gmail.fetch_emails__WORK`, `gmail.fetch_emails__PERSONAL`).
