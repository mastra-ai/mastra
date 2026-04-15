---
"@mastra/schema-compat": patch
---

fix: handle circular $ref schemas in schema-compat

Replace JSON.parse(JSON.stringify(...)) with cycle-safe deep clone to prevent crashes when dereferenced JSON schemas contain circular references.
