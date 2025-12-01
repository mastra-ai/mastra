---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/mcp': patch
---

Unified MastraServer API with MCP transport routes

**Breaking Changes:**
- Renamed `HonoServerAdapter` to `MastraServer` in `@mastra/hono`
- Renamed `ExpressServerAdapter` to `MastraServer` in `@mastra/express`
- Configuration now passed to constructor instead of separate method calls
- Renamed base class from `ServerAdapter` to `MastraServerBase` in `@mastra/server`

**New Features:**
- Added MCP transport routes (HTTP and SSE) to server adapters
- MCP endpoints available at `/api/mcp/:serverId/mcp` (HTTP) and `/api/mcp/:serverId/sse` (SSE)
- Added `express.json()` middleware compatibility for MCP routes
- Moved authentication helpers from deployer to `@mastra/server/auth`

**Testing:**
- Added shared MCP route and transport test suites in `@internal/server-adapter-test-utils`
- Added comprehensive MCP endpoint tests for both Hono and Express adapters
- Added GitHub Actions workflow for server adapter CI testing
