---
"@mastra/server": patch
---

Export `MastraServerBase` from `@mastra/core/server` so framework adapters that manage routing independently can share the same server base class.
