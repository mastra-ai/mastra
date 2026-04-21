---
'@mastra/core': patch
---

Fixed user preferences storage not being composed in `MastraCompositeStore`. Starring agents, starring skills, and toggling preview mode now work correctly when using a composite storage setup.

Also added a new `TABLE_USER_PREFERENCES` constant and schema so storage adapters can implement the `userPreferences` domain against a shared table definition.
