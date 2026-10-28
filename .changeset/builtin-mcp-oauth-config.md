---
'@mastra/core': minor
---

Added `server.mcp.oauth` (`resource`, `authorizationServers`, `scopesSupported`) to configure OAuth discovery and token audience checks for the built-in MCP server. Auth providers can implement the new optional `getOAuthMetadata()` and `verifyAudience()` methods to advertise their authorization server and check the token audience. `CompositeAuth` combines the authorization servers of its providers and checks the audience with the provider that accepted the token.
