---
'@mastra/core': patch
---

Fixed `read_file` returning only metadata for `.jsonl`, `.php` and `.dart` files. Their MIME types (`application/jsonl`, `application/x-php`, `application/dart`) are now treated as text, so the file content is returned.
