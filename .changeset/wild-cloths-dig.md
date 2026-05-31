---
'@mastra/core': patch
'@mastra/schema-compat': patch
---

Replace Function() eval with CSP-safe runtime Zod converter to fix CSP violations in Mastra Studio
