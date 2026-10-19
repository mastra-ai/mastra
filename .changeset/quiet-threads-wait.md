---
'mastra': patch
---

Fixed the first message of a new Factory session sometimes disappearing, both live and after a refresh. If sending the first message fails with a network or server error, the server may already have it. The notice now says it may have been sent, so check the transcript before you retry.
