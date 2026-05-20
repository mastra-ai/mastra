---
'@mastra/mcp': patch
---

Fixed an issue where OAuth token requests dropped `client_id` and `client_secret` for confidential clients. The provider previously shipped an empty `addClientAuthentication` method that satisfied the MCP SDK's existence check and short-circuited its default credential attachment, causing `invalid_request` errors on token exchange and refresh against confidential-client OAuth servers. The empty stub has been removed so the SDK's built-in client authentication runs again. See [#16854](https://github.com/mastra-ai/mastra/issues/16854).
