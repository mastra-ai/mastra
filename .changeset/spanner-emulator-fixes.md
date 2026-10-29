---
'@mastra/spanner': patch
---

Fixed several Spanner storage bugs:

- Background task updates (status changes, lease claims, renewals, releases) no longer fail with `this.database.runUpdate is not a function`.
- Filtering messages by a `null` metadata value no longer fails with a Spanner type error.
- Skills now save and return `files`, and updating a skill's content creates a new version, matching the other storage adapters.
