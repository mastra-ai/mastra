---
'mastra': patch
---

Factory chats now open each session by its session id, while the session's memory lives under its Factory or its owner. Slack "View session" links use `?sessionId=`; links already posted with `?resourceId=` still open.
