---
'@mastra/schema-compat': patch
---

Fixed OpenAI tool schema conversion to avoid duplicating nested optional object and array definitions, preventing compatible MCP tools from being rejected.
