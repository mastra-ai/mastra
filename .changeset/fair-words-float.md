---
'@mastra/pg': patch
---

Fix `listWorkflowRuns` failing with "unsupported Unicode escape sequence" error when filtering by status on snapshots containing null characters (`\u0000`) or unpaired Unicode surrogates (`\uD800-\uDFFF`).

The fix uses `regexp_replace` to sanitize problematic escape sequences before casting to JSONB in the WHERE clause, while preserving the original data in the returned results.
