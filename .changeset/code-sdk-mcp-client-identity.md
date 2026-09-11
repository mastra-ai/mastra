---
'@mastra/code-sdk': minor
'mastracode': patch
---

MCP OAuth servers in `mcp.json` now need a client identity. `@mastra/mcp` 2.x no longer registers clients dynamically, so a bare `url` entry can't be authenticated any more: set `oauth.clientId` for a client pre-registered with the authorization server, or the new `oauth.clientMetadataUrl` for a Client ID Metadata Document. `authenticateServer` reports which option to configure instead of provisioning a client, and the `/mcp` setup hint describes the new requirement.
