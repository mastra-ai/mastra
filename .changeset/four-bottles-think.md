---
'@mastra/mcp': patch
---

Fixed MCPClient never settling after a failed connect when releasing its process hooks threw, so callers now receive the original connect error and a later connect retries instead of replaying the failure (#30820). Releasing the hooks now attempts every handler on its own, so a host that refuses one removal no longer leaves the rest installed.
