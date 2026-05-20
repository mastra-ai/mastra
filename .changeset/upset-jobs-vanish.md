---
'@mastra/mcp': patch
---

Fixed OAuth token requests silently dropping client_id and client_secret when using MCPOAuthClientProvider. Confidential-client flows now correctly send credentials to the token endpoint. See https://github.com/mastra-ai/mastra/issues/16854
