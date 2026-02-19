---
'@mastra/playground-ui': patch
---

Fixed agent publish flow to no longer auto-save a draft. Publish now only activates the latest saved version. Save and Publish buttons are disabled when there are no changes or no unpublished draft, respectively.
