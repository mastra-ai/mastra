---
'@mastra/core': patch
---

Dynamic workflow validation now reads JSON-Schema `properties` as own keys, so a field named `constructor` or `toString` no longer looks present on every schema
