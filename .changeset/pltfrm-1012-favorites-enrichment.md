---
'@mastra/server': patch
---

Stored agent and skill POST, PATCH, and (for skills) publish responses now run favorites enrichment, so `isFavorited` is present on every read/write response path instead of only on GET/LIST. Under auth-off, those same paths also strip `favoriteCount` to match GET. Introduces `enrichOrStripFavorites` in the favorites enrichment helpers.
