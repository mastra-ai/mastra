---
'@mastra/core': patch
---

Fixed thread metadata updates to merge with existing fields instead of replacing them. Previously, updating a thread's metadata would silently drop any fields not included in the update. Now existing metadata fields are preserved when updating.
