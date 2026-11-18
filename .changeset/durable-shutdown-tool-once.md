---
'@mastra/core': patch
---

Fixed durable agents running a tool twice when the server shuts down gracefully while the tool is running. Shutdown now gives a running tool call a short window to finish and starts no further tool calls meanwhile. A result saved in that window is kept, and recovery continues from it instead of calling the tool again. A tool that finishes too late to be saved can still run again on recovery. If the tool is still running after the window, the run stays claimed until its lease expires, so recovery doesn't start it alongside the running call before then.
