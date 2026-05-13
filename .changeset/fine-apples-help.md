---
'mastra': patch
---

Fixed Agent Builder edit page closing the configure detail pane after autosave. The readiness check now uses React Query's `isLoading` (initial load only) instead of `isPending`, so background refetches triggered by autosave no longer remount the page and reset the open detail pane.
