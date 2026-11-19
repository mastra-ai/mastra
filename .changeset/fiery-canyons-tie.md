---
'@mastra/factory': minor
---

Fixed the Factory MCP endpoint accepting any Mastra Platform login. It now accepts only access tokens issued for that endpoint, so a token handed to an MCP client can no longer be used on the Platform API or another Factory, and a third-party MCP server cannot obtain one by sending users through the Mastra sign-in.

The endpoint moved to `https://<your-factory>/mcp` and serves the organization's Factory project; an organization with several projects gets `409 multiple_projects`. Its authorization server must issue tokens bound to this URL (RFC 8707 Resource Indicators): on Mastra Platform, register `https://<your-factory>/mcp` as a resource in AuthKit. Connectors set up with the old `/web/factory/projects/<projectId>/mcp` URL need to be added again with the new one.

With self-managed WorkOS auth, every MCP request also checks the caller's current organization membership in WorkOS, so removing someone from the organization ends their MCP access immediately, and audit entries for MCP changes show their name.
