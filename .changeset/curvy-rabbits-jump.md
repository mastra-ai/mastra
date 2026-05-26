---
'mastra': minor
---

Added maintainer-only source mode for resolving linked Mastra packages from local source. Local repo commands can opt in with `MASTRA_REPO_RUN_FROM_SOURCE=true` so package-local tests, the curated root source-safe test lane, and linked-project dev runs resolve workspace packages from source without prebuilt artifacts. `mastra dev` only honors the env var when the installed CLI is linked to a Mastra repo checkout, keeping published CLI behavior unchanged. Source-mode dev startup avoids recursive node_modules links, and source-mode CLI builds now skip JS/declaration artifacts and run a package-bounded no-build typecheck; this checks CLI source locally but does not replace full declaration generation or transitive workspace type validation.
