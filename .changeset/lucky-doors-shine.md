---
'@mastra/mcp': patch
'mastracode': patch
---

Security hardening from CodeQL review: MCP serverless 500 responses no longer echo internal error messages to clients (details are still logged server-side), and macOS system notifications now escape backslashes and run osascript without a shell so notification text can't inject commands.
