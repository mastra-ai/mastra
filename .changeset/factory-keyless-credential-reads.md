---
'@mastra/factory': patch
---

Fixed saved provider credentials showing as "Not set" when a Factory server starts without its credential encryption key. Previously that server treated each encrypted credential as an unreadable plain value, so providers looked disconnected with nothing in the logs. It could also rewrite the stored credential so that servers with the key could no longer read it. The server now refuses to read encrypted credentials without the key and logs a clear error. Credentials damaged by the old behavior are repaired the next time a server with the key reads them.
