---
'@mastra/mcp': minor
---

Add serializable MCP tool definitions and lazy hydration.

`MCPClient` can now export its tool catalog as plain JSON and rebuild executable tools from it later, without reconnecting at startup. This removes the need to connect to every MCP server on every cold start just to discover tools that may never be called.

- `listToolDefinitions()` returns definitions grouped by server and keyed by tool name. The result is JSON-serializable, so it can be cached in Redis, a database, or a build artifact.
- `listToolDefinitionsWithErrors()` also reports per-server failures, so a partial catalog isn't cached silently.
- `toolFromDefinition({ serverName, definition })` rebuilds a single tool from a cached definition.
- `toolsFromDefinitions({ definitions })` rebuilds a whole namespaced tool map, matching the `serverName_toolName` keys from `listTools()`.

Hydrated tools connect lazily on first execution and behave the same as discovered tools, including strict-mode metadata, approval policies, structured content, tool error handling, progress metadata, abort signals, and reconnect and retry behavior. Definitions capture the server version and instructions recorded at discovery time so that metadata isn't lost.

Existing `listTools()` and `listToolsets()` behavior is unchanged.
