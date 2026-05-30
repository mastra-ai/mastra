---
'@mastra/server': patch
---

Stored agent and skill POST, PATCH, and skill publish responses now include `isFavorited`, matching GET behavior. Clients can read favorite status from write responses without an extra GET request.

Under auth-off, write responses also omit `favoriteCount` to match GET, so the response shape is consistent across all single-entity endpoints.
