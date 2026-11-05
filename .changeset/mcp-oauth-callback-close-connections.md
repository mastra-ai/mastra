---
'@mastra/mcp': patch
---

Fixed `MCPClient.authenticate()` hanging after a successful browser sign-in. The loopback OAuth callback server now closes every open connection when it shuts down, including spare connections the browser opened and never used, so sign-in returns as soon as the authorization code arrives instead of waiting minutes for the browser to drop them.
