---
'@mastra/connect': patch
---

Exported the multi-connection toolset helpers (`buildProxyMultiConnectionTools`, `buildMcpMultiConnectionTools`, `toNamedConnections`, `listConnectionsToolKey`), `resolveClient`, and the `ResolvedClient`, `NamedConnection`, `ProxyProviderRegistration` and `McpProviderRegistration` types so servers can build per-request Connect toolsets with the same `connection_name` and `list_connections` behavior as `tools()`.
