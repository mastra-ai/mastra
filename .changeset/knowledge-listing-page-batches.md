---
'@mastra/core': patch
---

Fixed pinned Knowledge listings stopping at 100 pages per level. A listing now reads every child of a page while its token budget has room, and only ends with "…and more" when the budget runs out.
