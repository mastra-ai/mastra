---
'mastra': patch
---

Fixed the first message of a new Factory session sometimes disappearing, both live and after a refresh. The message now waits until the session is connected to its thread before it is sent. It still shows in the chat right away. If the session fails to start, the message and any attached images go back into the composer with a notice instead of being lost. If sending fails with a network or server error, the server may already have the message. The notice then says it may have been sent. Check the transcript before you retry.
