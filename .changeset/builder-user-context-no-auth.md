---
'mastra': patch
---

Fixed agents created in the Agent Builder failing to respond to their first message when authentication is turned off. New agents were expecting a signed-in user even in projects without authentication, so the first message errored out. Agents created without authentication now work straight away.
