---
'mastra': patch
---

Fixed the default project scaffold failing the deploy preflight check. New projects now read the database URL from TURSO_DATABASE_URL when it is set (for example from a hosted database created with `mastra env db create`) and fall back to a local file during development, so the first `mastra deploy` is no longer blocked by a local storage path error.
