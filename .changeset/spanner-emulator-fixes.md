---
'@mastra/spanner': patch
---

Background task status updates, lease claims, renewals and releases now work on Spanner. Filtering messages by a `null` metadata value now works. Skills now save and return `files`, and updating a skill's content creates a new version.
