---
'mastra': patch
---

Studio chat now puts your message back in the composer when it could not be sent. The text and the attachments used to disappear before the error showed up, for example when a file made the request too large for the server. Text typed while the request was pending stays, after the restored message. After a server error, the agent may already have stored the message, so it isn't put back and can't be sent twice.
