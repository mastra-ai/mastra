---
'mastra': patch
---

Fixed Studio asking for a Mastra instance URL while your server is still starting. Studio now waits for the server and connects once it's up. If the server rejects the connection, Studio shows the reason (authorization, wrong URL or API prefix, CORS) above a filled-in form.

Also fixed a connected Studio being replaced by that form when you return to its tab while `mastra dev` restarts.
