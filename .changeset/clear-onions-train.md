---
'@mastra/core': patch
---

Fixed `skill_read` returning an empty string when `startLine` is past the end of a file, which left agents unable to tell end-of-file from a failed read so they kept paginating. It now returns the total line count with an explicit end-of-file message, and prefixes ranged reads with a `(lines 350-428 of 428)` header. Full-file reads are unchanged.
