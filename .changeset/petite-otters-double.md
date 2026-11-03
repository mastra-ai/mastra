---
'@mastra/core': patch
---

Fixed viewing NDJSON and JSONL MIME aliases as paginated text, including MIME parameters. Text MIME types that declare a non-UTF-8 charset now return binary metadata instead of garbled text.
