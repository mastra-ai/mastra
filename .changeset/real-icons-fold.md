---
'@mastra/platform': minor
---

Added an `importers` option to `PlatformKnowledge` that takes importer classes, e.g. `new PlatformKnowledge({ importers: [HelpSpotImporter] })`, and an `importerClasses` getter that returns them. This is how an app offers its importer classes to Mastra Platform, which can read each class's manifest. Listing the same class twice keeps one copy. If two different classes share an id, the first one is kept, and once the knowledge is registered with `Mastra` a warning goes to the app's logger.
