---
'@mastra/mysql': patch
---

Fixed workflow snapshots and AI spans creating duplicate records instead of updating in place. Each workflow step previously inserted a new row, causing unbounded table growth and degraded read performance.
