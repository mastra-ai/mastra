---
'@mastra/connect': patch
---

Fixed `fireflies_get_transcript` failing on most real transcripts. Fireflies returns `summary.keywords` as a list and `speakers[].id` as a number, which the tool previously rejected with a validation error. The tool now accepts both shapes and still returns keywords as a comma-separated string and speaker ids as strings.
