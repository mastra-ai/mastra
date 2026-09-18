---
'@mastra/mongodb': patch
---

Fixed dataset storage to preserve authored strings and distinguish omitted item fields from explicit null through updates and version history. Cleared dataset schemas now read as undefined. Previously lost values cannot be recovered automatically.
