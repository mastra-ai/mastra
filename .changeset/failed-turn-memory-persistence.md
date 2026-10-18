---
'@mastra/core': patch
---

Fixed failed agent turns losing history in memory when running in-process. Durable and evented agents already kept the full history.

- If the model stream drops partway through a reply, the text streamed so far is now saved next to the error instead of being thrown away.
- If an input processor throws, the user message and the error are now saved instead of leaving the thread empty.
