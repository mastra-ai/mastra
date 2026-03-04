---
'mastracode': patch
---

Fixed `request_sandbox_access` tool not expanding tilde paths (`~/.config/...`), which caused it to incorrectly report access as already granted. Also fixed newly approved paths not being accessible until the next turn by calling `setAllowedPaths` immediately after approval.
