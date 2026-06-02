---
'@mastra/core': patch
'@mastra/auth-better-auth': patch
'@mastra/auth-cloud': patch
'@mastra/auth-okta': patch
'@mastra/auth-workos': patch
'@mastra/auth-studio': patch
'@mastra/mcp': patch
---

Removed Hono from @mastra/core and auth package runtime dependencies. Auth providers now receive framework-agnostic request types that support standard Request objects and Hono-compatible request shapes, and MCP avoids exposing Hono context types through core.
