---
'mastracode': patch
---

Fixed ordinary tool output being mistaken for background work when experimental background tools are enabled. Background rendering now uses task metadata instead of matching output text, and correctly recognizes resumed tasks and completed history.
