---
'mastra': patch
---

Added `mastra api factory board phases` and `mastra api factory work-item filter-options`, which read the first cards under each phase of a Factory board and the labels and people it can be filtered by.

```bash
mastra api factory board phases <project-id> work '{"label":["bug"],"limit":10}'
mastra api factory work-item filter-options <project-id>
```
