---
'mastra': patch
---

Added `mastra api factory work-item columns` and `mastra api factory work-item filter-options`, which read the first cards of each column of a Factory board and the labels and people it can be filtered by.

```bash
mastra api factory work-item columns <project-id> '{"board":"work","label":["bug"],"limit":10}'
mastra api factory work-item filter-options <project-id>
```
