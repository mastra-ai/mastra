---
'@mastra/core': patch
---

The workspace `read_file` tool now reads NDJSON and JSONL files as paginated text when the filesystem reports an NDJSON MIME type (such as `application/x-ndjson`) or adds a UTF-8 `charset` parameter, instead of refusing them as binary. Files whose MIME type declares a non-UTF-8 charset still return file metadata rather than garbled text.
