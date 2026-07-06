---
'@mastra/pg': patch
---

Fixed the ESM build never creating the `mastra_observational_memory` table. The OM schema was loaded through a dynamic `require` that esbuild rewrites to a throwing shim in the ESM output, and the silent catch skipped the table's creation, so `deleteThread()` crashed with Postgres error 42P01 on databases initialized from ESM processes (plain node ESM, tsx, vitest). The schema is now imported statically, which the `@mastra/core` peer dependency range guarantees is available.
