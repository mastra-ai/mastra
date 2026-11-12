---
'@mastra/hono': patch
'@mastra/editor': patch
'@mastra/server': patch
---

Fixed stored agents loaded by several requests at the same time sometimes being treated as code-defined agents. Those copies skipped the stored-agent visibility check, so another user could briefly read or run a private stored agent right after it was created, edited or the server started.
