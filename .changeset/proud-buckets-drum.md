---
'@mastra/core': patch
---

Fixed a crash where a background process started with the `execute_command` workspace tool could terminate the host process. If the exit callback threw or the process could not be observed after the PID was returned, the failure escaped as an unhandled promise rejection. These failures are now caught and logged instead.
