---
'mastra': minor
---

Added maintainer-only source mode for resolving linked Mastra packages from local source. Local repo commands can opt in with `MASTRA_SOURCE_MODE=true` so package-local tests, the curated root source-safe test lane, and linked-project dev runs resolve workspace packages from source without prebuilt artifacts. `mastra dev` only honors the env var when the installed CLI is linked to a Mastra repo checkout, keeping published CLI behavior unchanged. Source-mode dev startup avoids recursive node_modules links, watches linked workspace package source files for restarts, and keeps build scripts on the normal artifact build path.
