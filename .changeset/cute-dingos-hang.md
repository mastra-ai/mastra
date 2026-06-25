---
'@internal/playground': patch
---

Fixed read-only workspaces briefly showing create and delete actions in Studio. When opening a read-only workspace directly by URL, the file browser could expose create folder, delete, and add skill controls until the workspace list finished loading. The page now reads the read-only status from the workspace itself, so these write actions stay hidden for read-only workspaces.
