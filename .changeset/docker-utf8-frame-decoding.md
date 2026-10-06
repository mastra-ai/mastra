---
'@mastra/docker': patch
---

Fixed Docker sandbox process output corrupting non-ASCII characters. Emoji, CJK, and accented text in `stdout`/`stderr` no longer turn into `�` when a character spans Docker stream frames — streamed output, `handle.stdout`/`handle.stderr`, and `wait()` results now contain the original text.
