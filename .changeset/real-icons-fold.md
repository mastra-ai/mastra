---
'@mastra/platform': minor
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added an `importers` option to `PlatformKnowledge` that takes importer classes, e.g. `new PlatformKnowledge({ importers: [HelpSpotImporter] })`, and an `importerClasses` getter that returns them. Platform reads each class's manifest to list it in the Knowledge UI, then supplies each configured source itself. Listing the same class twice is harmless. If two different classes share an id, the first one is kept and a warning is logged.
