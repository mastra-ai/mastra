---
'@mastra/factory': patch
---

Fixed the memory budgets losing what a pending pass will free. The figure appeared on first paint and disappeared as soon as the session streamed its first update; it now holds, and opening a budget shows the slice the pass will free hatched at the end of the fill.
