---
'@mastra/core': patch
'@mastra/auth-better-auth': patch
'@mastra/auth-cloud': patch
'@mastra/auth-okta': patch
'@mastra/auth-workos': patch
'@mastra/auth-studio': patch
'@mastra/mcp': patch
'@mastra/deployer': patch
---

Removed Hono from @mastra/core and auth package runtime dependencies. Auth providers now receive framework-agnostic request types that support standard Request objects and Hono-compatible request shapes. MCP and deployer avoid relying on core-bundled Hono context types at package boundaries.
