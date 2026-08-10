---
'@mastra/mcp': patch
---

Fix SSE transport fallback against MCP 2.0 servers. The Streamable HTTP transport reports non-OK responses as `SdkHttpError`, which carries the HTTP status on `status` while `code` holds a string error code, so the fallback check read a string where it expected a status number and rethrew instead of retrying over the deprecated HTTP+SSE transport. Servers that only speak HTTP+SSE are reachable again.
