---
'@mastra/memory': patch
---

Observational Memory now saves the token counts it makes for older history, including messages it already buffered. Previously those counts were dropped on save, so threads that had been buffered were counted in full again on every request.
