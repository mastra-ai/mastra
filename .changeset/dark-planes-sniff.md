---
'mastracode': patch
---

Move the sidebar's relativeTime helper into a shared src/shared/lib/date module and reimplement it with date-fns instead of hand-rolled date math. Output is unchanged except week-old dates now format via date-fns (MMM d). Internal refactor, no user-facing behavior changes.
