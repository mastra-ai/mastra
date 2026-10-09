---
'@mastra/server': patch
---

Fixed a security issue where a signed-in user could take over another user's thread by creating a thread or conversation that reused its id. `POST /api/memory/threads` and `POST /api/v1/conversations` now return 403 when the id belongs to a thread owned by a different resource. The original owner keeps the thread, its title, metadata and messages. Re-creating your own thread with the same id still works.
