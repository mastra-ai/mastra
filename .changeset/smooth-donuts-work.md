---
'mastracode': patch
---

Renamed `request_sandbox_access` tool to `request_access`. Fixed tilde paths (`~/.config/...`) not being expanded, which caused the tool to incorrectly report access as already granted. Fixed newly approved paths not being accessible until the next turn by calling `setAllowedPaths` immediately after approval.
