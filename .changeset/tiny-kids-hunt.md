---
'@mastra/client-js': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed PATCH requests not sending content-type: application/json header, which caused the server to skip body parsing. This broke stored agent updates (edits) since the request body was silently ignored.
