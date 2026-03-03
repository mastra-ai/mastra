---
'mastracode': patch
---

Added MASTRA_DEBUG environment variable to gate debug.log file writing. When MASTRA_DEBUG=true is set, console.error and console.warn output is captured to a debug.log file in the app data directory. The log file is automatically truncated to ~4 MB on startup if it exceeds 5 MB, preventing unbounded disk usage over time.
