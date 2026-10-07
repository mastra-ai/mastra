---
'@mastra/playground-ui': patch
---

Added a Tags filter to the Traces list. When the observability store supports trace queries, you can filter traces by tags such as `production` or `manual-review`, exclude tags, or keep only traces that have (or lack) tags. Known tag values are suggested as you type.

Fixed the Traces list showing "Failed to load traces" when a shared or hand-edited URL gave the feedback comment filter a text value. That filter only supports "exists" and "does not exist", so the invalid filter is now ignored instead.
