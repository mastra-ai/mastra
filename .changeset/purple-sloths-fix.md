---
'@mastra/core': patch
---

Fixed a race where a background tool result could be saved to memory without its configured transcript transform applied. When a background task finished while the turn was still being persisted, the memory history save could land last and store the raw tool result instead of the redacted one. All persistence paths now apply the same transcript redaction, so raw payloads never reach storage.
