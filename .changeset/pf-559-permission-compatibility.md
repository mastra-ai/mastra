---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed an issue where regenerating permissions would break existing RBAC role configurations. RBAC roles created before this update will continue to work correctly.
