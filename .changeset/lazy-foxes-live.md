---
'@mastra/server': patch
---

Fixed sort direction parameters being silently ignored in Thread Messages API when using bracket notation query params (e.g., `orderBy[field]=createdAt&orderBy[direction]=DESC`). The `normalizeQueryParams` function now reconstructs nested objects from bracket-notation keys, so both JSON format and bracket notation work correctly for `orderBy`, `filter`, `metadata`, and other complex query parameters. (Fixes #12816)
