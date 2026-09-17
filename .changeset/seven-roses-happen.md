---
'@mastra/mysql': patch
---

Fixed dataset storage to preserve JSON null, JSON-looking strings, and Unicode text through reads, updates, and version history. Cleared optional dataset configuration now reads as undefined. Previously lost null distinctions cannot be recovered automatically.
