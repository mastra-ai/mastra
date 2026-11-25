---
'@mastra/factory': minor
---

Fixed the Factory MCP endpoint accepting any Mastra Platform login. It now accepts only access tokens issued for that endpoint, and the Factory's other routes refuse those tokens (with WorkOS or Platform auth, any token issued for another resource), so a token handed to an MCP client works on that endpoint alone, not on the rest of the Factory or on another Factory.

The endpoint moved to `https://<your-factory>/mcp` and serves the organization's Factory project (its first, if it created more). Its authorization server must issue tokens bound to this URL (RFC 8707 Resource Indicators): on Mastra Platform, register `https://<your-factory>/mcp` as a resource in AuthKit. Connectors set up with the old `/web/factory/projects/<projectId>/mcp` URL need to be added again with the new one.

```bash
# Before: POST https://<your-factory>/web/factory/projects/<projectId>/mcp
curl -X POST https://<your-factory>/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

With self-managed WorkOS auth, every MCP request also checks the caller's current organization membership in WorkOS, so removing someone from the organization ends their MCP access immediately, and audit entries for MCP changes show their name.
