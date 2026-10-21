---
'mastra': patch
---

MCP server pages in Studio now show the server's event types (experimental), with their delivery modes and argument and payload schemas. Opening an event lets you stream it (or poll it, for poll-only types), shows each occurrence with its data, the cursor, and a marker where events may have been skipped. Under `mastra dev` you can also send a test event and watch it arrive in the open stream.
