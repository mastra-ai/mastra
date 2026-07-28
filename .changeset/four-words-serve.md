---
'@mastra/factory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Fixed session creation ignoring an exact thread id when the session was already live. Requesting a session with a threadId now resumes or creates that exact thread even when another request (like an event subscription or message listing) created the session first, preventing 'Thread not found' errors for workspace threads.
