---
'@mastra/core': minor
---

Added experimental Knowledge importers. Write an importer as `{ id, run(ctx) }` and run it against an existing Knowledge instance with `runKnowledgeImporter(knowledge, importer)` to bring content from another system into Knowledge pages. Scheduling is left to you. Runs are recorded, cursors persist with `ctx.state`, and pages the source no longer has are removed after a successful full run.
