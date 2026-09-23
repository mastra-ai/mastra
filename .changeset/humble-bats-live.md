---
'@mastra/pg': patch
---

Repair NUL characters and unpaired surrogates before serializing PostgreSQL JSONB values across storage domains, while preserving literal Unicode escape text. Fixes #24873.
