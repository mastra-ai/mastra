---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/editor': minor
---

Adds the v1 ToolProvider runtime, server surface, client SDK methods, and editor wiring used by Agent Builder to manage OAuth-backed integrations.

- New `ToolProvider` VNext surface (`listToolkitsVNext`, `listToolsVNext`, `resolveToolsVNext`) alongside the v1 catalog surface, plus `BaseToolProvider` for shared behavior
- Auth round-trip on the `ToolProvider` interface (`authorize`, `getAuthStatus`, `getConnectionStatus`, `listConnections`, `disconnectConnection`, `listConnectionFields`, `health`)
- Per-author / shared / caller-supplied connection scoping via `resolveConnectionAuthorId()` and request-context plumbing
- Server routes under `/tool-providers/*` (12 routes: authorize, auth-status, connection-status, connections list with `page`/`perPage` pagination, disconnect, usage, fields, health) and matching `@mastra/client-js` `ToolProvider` resource methods
- Stored-agent `toolProviders` config shape (`{ connections, tools }`) and runtime merge in `editor.agent.applyStoredOverrides`
- Composio provider rewrite implementing the new surface

Builds on the `tool_provider_connections` storage domain shipped in PR 1.

Additive — no breaking changes. Studio UI ships separately.

PR 2 of 3 split from #17224.
