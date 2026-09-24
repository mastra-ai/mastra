---
'@mastra/pg': patch
---

Fix PostgreSQL saves failing on NUL characters or unpaired surrogates while preserving literal Unicode escape text. Fixes #24873.
