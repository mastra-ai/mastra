---
'mastra': patch
---

Rename `mastra env db detach` to `mastra env db delete` and make the confirmation prompt state that the database and all of its data are permanently deleted with the provider. The old name described a non-destructive unlink, but the operation deprovisions the Turso/Neon database — data included. The `detach` name is reserved for a future true non-destructive detach.
