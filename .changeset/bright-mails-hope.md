---
'mastra': patch
---

Improved `mastra dev` shutdown: on Ctrl-C the server now gets the same 5 seconds to shut down that it gets on a hot reload, instead of being killed after 2 seconds.
