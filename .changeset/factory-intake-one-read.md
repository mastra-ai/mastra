---
'mastra': patch
---

Improved the Factory board's Intake and Triage columns. They now load from one list the server keeps instead of asking every connected provider every 30 seconds, so an open board makes no provider request. The columns update when the server reports a change, and a tab left in the background asks for nothing.

When the server could not read a source, the column keeps what it last listed and says the list may be out of date.
