---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge storage now logs a warning when it replaces an older, experimental Knowledge layout that still holds data. Upgrading from published v1 or pre-release Knowledge builds still discards that data rather than migrating it, but the warning now names the layout that was replaced and how many rows were dropped from each table, so the loss is no longer silent. Replacing an empty layout logs nothing.
