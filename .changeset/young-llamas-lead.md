---
'mastra': patch
---

Fixed messages typed while a user session's workspace is still preparing. The composer stays usable and sends the message straight to the controller, which holds it until the workspace is ready — the browser no longer queues it in memory, so the message survives leaving the page. Image attachments work during preparation too, and a workspace that fails to come up reports the server's own error instead of a generic timeout. Chat requests are no longer silently retried on network failures, which could deliver the same message several times after a dropped connection.
