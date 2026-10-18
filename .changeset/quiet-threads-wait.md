---
'mastra': patch
---

Fixed the first message of a new Factory session sometimes disappearing, both live and after a refresh. The message now waits until the session is connected to its thread before it is sent. It still shows in the chat right away. If the session fails to start, the message and any attached images go back into the composer with a notice instead of being lost.
