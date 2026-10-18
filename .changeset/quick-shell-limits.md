---
'@mastra/code-sdk': patch
---

Fixed foreground commands in Mastra Code to stop after 30 seconds unless the command specifies a timeout. Set timeout to 0 to disable the limit. Background processes are unaffected.
