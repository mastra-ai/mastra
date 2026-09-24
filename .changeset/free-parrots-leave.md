---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed /browser status wrongly reporting "Pending changes (not yet applied)" whenever a profile, executable path, or Stagehand model was configured. The session snapshot of the running browser was dropping those fields, so it never matched the settings file.
