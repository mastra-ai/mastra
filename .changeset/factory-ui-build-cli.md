---
'mastra': minor
---

Added automatic Factory UI building to `mastra build` and `mastra deploy`. When a Software Factory project is detected, the project's `build:ui` script runs before bundling, and the SPA is copied to `.mastra/output/factory/`. Build staleness checks now include Factory UI source files so UI-only edits trigger rebuilds.
