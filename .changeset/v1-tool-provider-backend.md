---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/editor': minor
'@mastra/libsql': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
---

v1 ToolProvider extensions — backend.

Adds the v2 ToolProvider surface used by Agent Builder to manage OAuth-backed
integrations:

- New `ToolProviderCapabilities` (`authorize`, `connections`, `listToolkits`, etc.)
- Auth round-trip on the `ToolProvider` interface (`authorize`, `getAuthStatus`,
  `getConnectionStatus`)
- Per-author / shared / caller-supplied connection scoping with
  `resolveConnectionAuthorId()` and request-context plumbing
- v2 list/resolve methods (`listTools`, `resolveTools`) alongside the v1 catalog
- New `tool_provider_connections` storage domain (in-memory base + LibSQL impl,
  plus shape additions for ClickHouse / Cloudflare KV)
- Server routes under `/tool-providers/*` (authorize, auth-status, connection-status,
  connections list, disconnect, usage, fields, health) and matching
  `@mastra/client-js` `ToolProvider` resource methods
- Stored-agent `toolProviders` config shape (`connections`, `tools`) and runtime
  merge in `editor.agent.applyStoredOverrides`

Additive — no breaking changes. Studio UI ships separately.
