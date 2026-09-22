---
'@mastra/weaviate': patch
---

Raise the `@mastra/core` peer dependency floor to `1.68.0`. The store previously accepted any core version from `1.0.0` onward, including releases it was never tested against, where a mismatched API surface could break at runtime.
