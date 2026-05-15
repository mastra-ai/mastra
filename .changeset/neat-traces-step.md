---
'@mastra/playground-ui': patch
---

Improved the Observability traces list. Replaced the ID column with a Level column whose icon shows whether each row is a top-level Trace or a nested Subtrace; the header tooltip shows a legend. Replaced the "List mode" option in the Add Filter menu with a standalone "Show subtraces" toggle — off shows only top-level traces, on includes subtraces. The toggle hides automatically when the active storage provider doesn't support subtraces.
