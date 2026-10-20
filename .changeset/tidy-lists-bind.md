---
'@mastra/spanner': patch
---

Fixed Spanner metric queries failing when a filter lists more than 950 trace IDs, experiment IDs, or metric names.
