---
'@mastra/core': patch
---

Remove hardcoded `/api/` prefix check from `registerApiRoute()`. The check incorrectly rejected custom routes starting with `/api/` even when users configured a different `apiPrefix`. Reserved-path validation is already handled at the server adapter level using the actual configured prefix.
