---
'mastra': patch
---

Added `mastra server pause` and `mastra server restart` for Mastra Server projects. Conflicts from the platform API (for example pausing when the instance is not running, or restarting while a running server) print a clear message.
