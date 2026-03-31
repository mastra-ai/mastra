---
'mastra': patch
---

Fixed `create-mastra` hanging after project creation on the gateway login path by properly closing the HTTP server and all keep-alive connections
