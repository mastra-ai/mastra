---
'mastracode': patch
---

Subagent model selections now update immediately during a session instead of appearing unchanged or reverting because stale MastraCode state was shown.

Before: switching a subagent model could still display the old selection. After: the active Harness v1 override is reflected right away.
