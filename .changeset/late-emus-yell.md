---
'@mastra/spanner': patch
---

Fixed dataset storage to preserve JSON null and JSON-looking strings through reads, updates, and version history. Cleared optional dataset configuration now reads as undefined. Previously lost values cannot be recovered automatically.
