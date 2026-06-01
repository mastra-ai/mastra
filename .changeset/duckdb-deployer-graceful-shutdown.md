---
'@mastra/deployer': patch
---

Added graceful shutdown to the server. On SIGINT/SIGTERM it now runs `mastra.shutdown()` before exiting, letting storage backends release resources (such as DuckDB's file lock) instead of being killed mid-flight. This fixes lock and resource leaks on `mastra dev` hot reloads.
