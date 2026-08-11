---
'mastracode': patch
---

Fixed a goal started on a new thread being cleared moments after it was set. Starting a goal that creates its own thread now persists that goal to the new thread instead of dropping it.
