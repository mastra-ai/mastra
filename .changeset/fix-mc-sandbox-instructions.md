---
'mastracode': patch
---

Fixed agent sandbox instructions to use the `request_access` tool instead of telling users to manually run `/sandbox`. The agent now requests directory access interactively, reducing friction when working with files outside the project root.
