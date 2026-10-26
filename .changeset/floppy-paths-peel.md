---
'@mastra/spanner': minor
---

Added storage for the optional background task fields `expiresAt` and `metadata`, plus filtering by `expiresAt`. Existing tables gain the new columns automatically when the store initializes.

Fixed background task updates failing with `this.database.runUpdate is not a function`, which stopped background tasks from running, suspending, or completing on Spanner.
