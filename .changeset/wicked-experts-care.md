---
'@mastra/editor': patch
---

Fixed `@mastra/editor` integrations (Composio, Arcade) collapsing every tool call onto a shared `'default'` user. Tools resolved during `agent.generate` now scope to the authenticated resource from the request context, so per-user OAuth connections route to the correct account instead of a shared one.
