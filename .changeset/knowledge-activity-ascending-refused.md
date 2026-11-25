---
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge activity reads now refuse `order: 'asc'` and `after` with a `RangeError`. Before, these stores ignored them and returned events newest first. Oldest-first activity isn't supported on these stores yet, and they don't report `supportsActivityAscending`.
