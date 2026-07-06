---
'mastracode': minor
---

Added a `/slack` command to connect your Slack account and use Slack tools (search, read, send messages, canvases, users) from the agent. The integration is off by default and fully managed from `/slack`: run `/slack connect` to authorize with a read-only, read-write, or full permission level (this also turns it on), `/slack level <level>` to change scopes, and `/slack disconnect` to turn it off and clear the token. It uses Slack's official MCP server with OAuth 2.0 + PKCE, so no client secret is stored and tokens refresh automatically.
