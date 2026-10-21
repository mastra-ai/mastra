---
'@mastra/deployer': patch
---

Fixed generated servers exiting immediately instead of shutting down gracefully on Ctrl-C under `mastra dev`, `mastra start`, or another tool that forwards the signal. The server receives Ctrl-C twice in a few milliseconds, once from the terminal and once from the parent, and treated the second as a request to force-quit. A second signal within 250ms of the first is now ignored, so in-flight requests drain and Mastra shuts down cleanly. Pressing Ctrl-C again after that still exits immediately.
