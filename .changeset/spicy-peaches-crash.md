---
'@mastra/factory': patch
'mastra': patch
---

Fixed the session status in Factory's sidebar and board. A person's own session now shows "Waiting on you" while its agent waits for their answer, instead of "Working". A session shows "Initializing" only while a run waits on its first setup, so a session whose setup never finished, or that never ran, no longer stays stuck on "Initializing".
