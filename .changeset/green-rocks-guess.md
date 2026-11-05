---
'@mastra/connect': patch
---

Fixed `fireflies_get_transcript` failing with a validation error on most real Fireflies transcripts. Fireflies sends summary keywords as a list and speaker ids as numbers; the tool now accepts both and still returns keywords as one comma-separated string and speaker ids as strings. Fixes [#29401](https://github.com/mastra-ai/mastra/issues/29401).
