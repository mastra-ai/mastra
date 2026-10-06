---
'@mastra/core': patch
---

Knowledge now rejects scope descriptions longer than 400 UTF-16 code units, the same limit node descriptions already have. This covers descriptions in a structure plan and in scope type templates, and both are checked when the Knowledge instance is constructed. Before this, a scope description of any length was stored as-is and passed into agent placement context.
