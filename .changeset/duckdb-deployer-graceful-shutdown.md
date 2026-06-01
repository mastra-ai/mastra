---
'@mastra/deployer': patch
---

The server now installs SIGINT/SIGTERM handlers and runs `mastra.shutdown()` before exiting, allowing storage backends to release resources cleanly instead of being terminated mid-flight.
