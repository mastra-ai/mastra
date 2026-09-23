---
'@mastra/playground-ui': minor
---

Added nested metadata filters to Studio with typed value suggestions and type-specific operators. Saved filter URLs now preserve strings, numbers, booleans, empty strings, whitespace, literal-dot keys, and paths ending in `.op` without changing filter meaning.

```text
metadata.retry.count >= 3
metadata.flags.reviewed = true
```
