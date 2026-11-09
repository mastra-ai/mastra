---
'@mastra/observability': patch
---

`SensitiveDataFilter` now redacts the whole value under a sensitive key, including objects and arrays. Before, it only redacted nested keys that were sensitive themselves, so `{ secret: { value: 'raw' } }` or `{ auth: { userId } }` still exposed the nested values in traces.
