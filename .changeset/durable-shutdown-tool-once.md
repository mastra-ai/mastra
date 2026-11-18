---
'@mastra/core': patch
---

Fixed durable agents running a tool twice when the server shuts down gracefully while the tool is running. Shutdown now gives a running tool call a short window to finish so its result is saved, and recovery continues from it instead of calling the tool again. If the tool is still running after that window, the run stays claimed until its lease expires, so recovery can't run the tool alongside it.
