---
'@mastra/react': minor
'@mastra/client-js': minor
'@mastra/server': minor
'@mastra/playground': minor
---

Added client, React, and Studio support for Agent signals in threaded chat. Threaded user messages now send through Agent signals, stream output is consumed from the thread subscription, echoed user messages are deduped by signal ID, file and image message contents are preserved, Studio can send follow-ups while a response is streaming, Studio subscribes to open threads so additional tabs can observe active streams, and the Studio stop button aborts the active thread subscription.
