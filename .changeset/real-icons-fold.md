---
'@mastra/platform': minor
---

Added an `importers` option to `PlatformKnowledge` that takes importer classes, e.g. `new PlatformKnowledge({ importers: [HelpSpotImporter] })`, and an `importerClasses` getter that returns them. This is how an app offers its importer classes to Mastra Platform, which can read each class's manifest. Listing the same class twice keeps one copy. If two different classes share an id, the first one is kept, and once the knowledge is registered with `Mastra` a warning goes to the app's logger.

`importers` needs a `@mastra/core` with Knowledge importers; on an older core, passing it throws at startup, and apps that don't pass it are unaffected. The option is typed with `PlatformKnowledgeImporterClass`, the part of core's importer class that `PlatformKnowledge` uses, so this release still installs and typechecks with older cores. It will switch to core's own type in the next major release.
