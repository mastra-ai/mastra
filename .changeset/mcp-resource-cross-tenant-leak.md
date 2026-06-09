---
"@mastra/mcp": patch
---

Fixed `MCPServer` leaking one caller's resources to other callers. The result of the first `resources/list` request was cached on the shared, long-lived server instance and replayed to everyone, so a dynamic resource provider that scopes resources per user or tenant (resolved from `extra.authInfo`) served the first caller's resource index — names and URIs — to subsequent callers. The same stale cache also backed `resources/read` URI resolution and the public `listResources()` method. The `resources/templates/list` handler had the same defect for dynamic resource template providers.

Resource and resource template providers are now invoked on every request with the current caller's context, so each caller only sees their own resources. See https://github.com/mastra-ai/mastra/issues/17609
