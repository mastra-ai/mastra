---
'mastra': patch
---

Fixed experiment worker builds to disable worker-side persistence, resolve relative project roots, and produce reproducible manifests that safely handle pnpm symlinks while excluding installed dependencies.
