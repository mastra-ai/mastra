---
'@mastra/core': patch
---

Knowledge page reads (`readKnowledgePage`) now also return the scope page of each related page. A note names a page in another scope by its `scope#path` ref, so the Knowledge explorer needs that scope to link the note to the page by name; without it, notes linking pages in another importer's scope showed the raw ref.
