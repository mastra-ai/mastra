---
'@mastra/core': patch
---

Fixed routing agent leaking internal selection reasoning as visible text when handling requests directly. Previously, when the routing agent decided no sub-agent was needed, its internal reasoning (selectionReason) was streamed to the user as text-delta events before the actual answer. Now only the actual answer from the validation step is shown. Fixes #12545.
