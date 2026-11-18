---
'@mastra/mcp': patch
---

Fixed MCPClient never settling after a failed connect when releasing its process hooks threw, so callers now receive the original connect error (#30820)
