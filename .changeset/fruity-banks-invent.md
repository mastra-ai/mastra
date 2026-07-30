---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added a chat notification when a GitHub plugin auto-update fails and is rolled back. Previously, if a background plugin update failed to install its dependencies, mastracode silently reverted to the previous version with no indication anything had happened. Now the chat shows a line naming the affected plugin and confirming the previous working version was kept, and the underlying error is written to stderr for debugging.
