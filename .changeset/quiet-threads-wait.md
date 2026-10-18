---
'mastra': patch
---

Fixed the first message of a new Factory session sometimes disappearing, both live and after a refresh. The message now waits until the session is connected to its thread before it is sent. It still shows in the chat right away. If the session fails to start, the message and any attached images go back into the composer with a notice instead of being lost. If sending it fails in a way the server may already have accepted it (a network error or server error), the notice says it may have been sent so you check the transcript before retrying.
