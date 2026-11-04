---
'@mastra/core': minor
---

Added experimental Knowledge importers. Register an importer on `Knowledge` with `importers` or `registerImporter()`, then call `runImporter()` to bring content from another system into Knowledge pages. Runs are recorded, cursors persist with `ctx.state`, and pages the source no longer has are removed after a successful full run.
