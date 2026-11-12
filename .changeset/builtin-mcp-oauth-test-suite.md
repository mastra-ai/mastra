---
'@mastra/server-adapters-test-suite': minor
---

Added `createBuiltinMCPOAuthTestSuite`, which checks that a server adapter serves the built-in MCP server's OAuth metadata, sends the `WWW-Authenticate` challenge, and enforces the token audience.

The package now has `@mastra/auth` and `jose` as peer dependencies, because the suite signs real tokens and verifies them with `MastraJwtAuth`. Install both alongside the test suite.
